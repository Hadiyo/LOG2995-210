import { computed, Injectable, signal } from '@angular/core';
import { AvatarId, Die } from '@common/character/character.model';
import { MatchPlayer } from '@common/game/match.interface';
import { GameMode, TileType } from '@common/maps/map.enums';
import { EditorCell } from '@common/maps/map.interface';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { generateClientId } from '@app/utils/id.util';
import { manhattanDistance, positionKey } from './match-geometry';
import { MatchBoardService } from './match-board.service';
import { MatchStateService } from './match-state.service';
import { TurnStateService } from './turn-state.service';

const PREVIEW_COUNTDOWN_SECONDS = 10;
const PREVIEW_COUNTDOWN_TICK_MS = 250;
const MILLISECONDS_PER_SECOND = 1000;
const TILE_DEFAULT = TileType.DIRT;
const ICE_COMBAT_PENALTY = -2;

export interface CombatOutcomeNotice {
    id: string;
    attackerId: string;
    defenderId: string;
    attackerMessage: string;
    defenderMessage: string;
    logMessage: string;
}

export type CombatStanceChoice = 'attack' | 'defense' | null;
export type CombatPanelOrientation = 'horizontal' | 'vertical';

export interface CombatPanelFighter {
    id: string;
    name: string;
    avatarId: AvatarId;
    attackDie: Die;
    defenseDie: Die;
    baseAttack: number;
    baseDefense: number;
    currentHealth: number;
    maxHealth: number;
    tileType: TileType;
    isDoorOpen: boolean;
    facing: PlayerFacing;
    pose: PlayerPose;
    teamId: string | null;
    isLocal: boolean;
}

export interface CombatPanelState {
    id: string;
    attackerId: string;
    defenderId: string;
    orientation: CombatPanelOrientation;
    round: number;
    countdownSeconds: number;
    fighters: [CombatPanelFighter, CombatPanelFighter];
}

export interface CombatRoundBreakdown {
    base: number;
    postureBonus: number;
    dieType: Die;
    dieValue: number | null;
    penalty: number;
    total: number | null;
}

export interface CombatRoundFighterLog {
    fighterId: string;
    fighterName: string;
    isLocal: boolean;
    stance: CombatStanceChoice;
    attack: CombatRoundBreakdown;
    defense: CombatRoundBreakdown;
    attackDelta: number | null;
    damage: number | null;
}

export interface CombatRoundLog {
    id: string;
    round: number;
    status: 'pending' | 'resolved';
    fighters: [CombatRoundFighterLog, CombatRoundFighterLog];
}

@Injectable({ providedIn: 'root' })
export class CombatStateService {
    readonly lastCombatUpdate = signal('');
    readonly lastCombatOutcome = signal<CombatOutcomeNotice | null>(null);
    readonly panelState = signal<CombatPanelState | null>(null);
    readonly roundLogs = signal<CombatRoundLog[]>([]);
    readonly localSelectedStance = signal<CombatStanceChoice>(null);
    readonly hasActiveCombat = computed(() => this.panelState() !== null);
    readonly footerMessage = computed(() => {
        if (!this.hasActiveCombat()) {
            return '';
        }

        const selectedStance = this.localSelectedStance();
        if (selectedStance === 'attack') {
            return 'Posture offensive selectionnee.';
        }

        if (selectedStance === 'defense') {
            return 'Posture defensive selectionnee.';
        }

        return 'Choisissez une posture pour preparer le combat.';
    });

    private previewCountdownStartedAt = 0;
    private previewCountdownTimerId: number | null = null;

    constructor(
        private readonly matchBoardService: MatchBoardService,
        private readonly matchStateService: MatchStateService,
        private readonly turnStateService: TurnStateService,
    ) {}

    startCombat(attackerId: string, defenderId: string): boolean {
        const match = this.matchStateService.match();
        const turnState = this.turnStateService.turnState();
        if (!match || match.endState || !turnState || turnState.phase !== 'active' || this.hasActiveCombat()) {
            return false;
        }

        const attacker = match.players.find((player) => player.id === attackerId) ?? null;
        const defender = match.players.find((player) => player.id === defenderId) ?? null;
        if (
            !attacker ||
            !defender ||
            manhattanDistance(attacker.position, defender.position) !== 1 ||
            (match.mode === GameMode.CTF && this.matchBoardService.isSameTeam(attacker, defender))
        ) {
            return false;
        }

        this.openCombatPanel(attacker, defender);
        return true;
    }

    setPanelState(panelState: CombatPanelState): void {
        this.stopPreviewCountdown();
        this.panelState.set(panelState);
        this.localSelectedStance.set(null);
        this.syncPreviewRoundLogs();
    }

    closeCombat(): void {
        this.stopPreviewCountdown();
        this.panelState.set(null);
        this.roundLogs.set([]);
        this.localSelectedStance.set(null);
    }

    selectStance(stance: Exclude<CombatStanceChoice, null>): void {
        if (!this.hasActiveCombat()) {
            return;
        }

        this.localSelectedStance.set(stance);
        this.syncPreviewRoundLogs();
    }

    private openCombatPanel(attacker: MatchPlayer, defender: MatchPlayer): void {
        const orientation = this.getOrientation(attacker, defender);
        const localPlayerId = this.matchStateService.localPlayer()?.id ?? null;
        const orderedPlayers = this.getOrderedPlayers(attacker, defender, orientation);
        const fighters = orderedPlayers.map((player, index) =>
            this.createPanelFighter(player, index, orientation, localPlayerId),
        ) as [CombatPanelFighter, CombatPanelFighter];

        this.panelState.set({
            id: generateClientId(),
            attackerId: attacker.id,
            defenderId: defender.id,
            orientation,
            round: 1,
            countdownSeconds: PREVIEW_COUNTDOWN_SECONDS,
            fighters,
        });
        this.localSelectedStance.set(null);
        this.syncPreviewRoundLogs();
        this.startPreviewCountdown();
    }

    private createPanelFighter(
        player: MatchPlayer,
        index: number,
        orientation: CombatPanelOrientation,
        localPlayerId: string | null,
    ): CombatPanelFighter {
        const cell = this.findPlayerCell(player);
        return {
            id: player.id,
            name: player.name,
            avatarId: player.avatarId,
            attackDie: player.attackDie,
            defenseDie: player.defenseDie,
            baseAttack: player.baseAttack,
            baseDefense: player.baseDefense,
            currentHealth: player.health,
            maxHealth: player.maxHealth,
            tileType: cell?.tileType ?? TILE_DEFAULT,
            isDoorOpen: !!cell && cell.tileType === TileType.DOOR && cell.isWalkable,
            facing: this.getFacing(index, orientation),
            pose: PlayerPose.Idle,
            teamId: player.teamId ?? null,
            isLocal: player.id === localPlayerId,
        };
    }

    private getOrientation(attacker: MatchPlayer, defender: MatchPlayer): CombatPanelOrientation {
        return attacker.position.y === defender.position.y ? 'horizontal' : 'vertical';
    }

    private getOrderedPlayers(
        attacker: MatchPlayer,
        defender: MatchPlayer,
        orientation: CombatPanelOrientation,
    ): [MatchPlayer, MatchPlayer] {
        if (orientation === 'horizontal') {
            return attacker.position.x <= defender.position.x ? [attacker, defender] : [defender, attacker];
        }

        return attacker.position.y <= defender.position.y ? [attacker, defender] : [defender, attacker];
    }

    private getFacing(index: number, orientation: CombatPanelOrientation): PlayerFacing {
        void orientation;
        return index === 0 ? PlayerFacing.Right : PlayerFacing.Left;
    }

    private findPlayerCell(player: MatchPlayer): EditorCell | null {
        return this.matchStateService.match()?.map.find((cell) => positionKey(cell.position) === positionKey(player.position)) ?? null;
    }

    private startPreviewCountdown(): void {
        this.stopPreviewCountdown();
        this.previewCountdownStartedAt = Date.now();
        this.updatePreviewCountdown();
        this.previewCountdownTimerId = window.setInterval(() => this.updatePreviewCountdown(), PREVIEW_COUNTDOWN_TICK_MS);
    }

    private updatePreviewCountdown(): void {
        const elapsedMs = Date.now() - this.previewCountdownStartedAt;
        const remainingSeconds = Math.max(
            0,
            Math.ceil((PREVIEW_COUNTDOWN_SECONDS * MILLISECONDS_PER_SECOND - elapsedMs) / MILLISECONDS_PER_SECOND),
        );
        this.panelState.update((panelState) => panelState ? { ...panelState, countdownSeconds: remainingSeconds } : panelState);

        if (remainingSeconds === 0) {
            this.stopPreviewCountdown();
        }
    }

    private stopPreviewCountdown(): void {
        if (this.previewCountdownTimerId !== null) {
            window.clearInterval(this.previewCountdownTimerId);
            this.previewCountdownTimerId = null;
        }
    }

    private syncPreviewRoundLogs(): void {
        const panelState = this.panelState();
        if (!panelState) {
            this.roundLogs.set([]);
            return;
        }

        this.roundLogs.set([this.createPreviewRoundLog(panelState)]);
    }

    private createPreviewRoundLog(panelState: CombatPanelState): CombatRoundLog {
        const fighters = panelState.fighters.map((fighter) =>
            this.createPreviewRoundFighterLog(fighter, fighter.isLocal ? this.localSelectedStance() : null),
        ) as [CombatRoundFighterLog, CombatRoundFighterLog];

        return {
            id: `${panelState.id}-round-${panelState.round}`,
            round: panelState.round,
            status: 'pending',
            fighters,
        };
    }

    private createPreviewRoundFighterLog(fighter: CombatPanelFighter, stance: CombatStanceChoice): CombatRoundFighterLog {
        return {
            fighterId: fighter.id,
            fighterName: fighter.name,
            isLocal: fighter.isLocal,
            stance,
            attack: this.createBreakdown(fighter.baseAttack, stance === 'attack' ? 2 : 0, fighter.attackDie, fighter.tileType),
            defense: this.createBreakdown(fighter.baseDefense, stance === 'defense' ? 2 : 0, fighter.defenseDie, fighter.tileType),
            attackDelta: null,
            damage: null,
        };
    }

    private createBreakdown(base: number, postureBonus: number, dieType: Die, tileType: TileType): CombatRoundBreakdown {
        return {
            base,
            postureBonus,
            dieType,
            dieValue: null,
            penalty: tileType === TileType.ICE ? ICE_COMBAT_PENALTY : 0,
            total: null,
        };
    }
}
