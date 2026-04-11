import { computed, effect, Injectable, signal } from '@angular/core';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { CombatPlayerStatistics, StancePayload } from '@common/combat/combat.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { PlayerPose } from '@common/player/player.interface';
import { CombatSocketEvents } from '@common/socket-events';
import {
    CombatOutcomeNotice,
    CombatPanelFighter,
    CombatPanelState,
    CombatResultPayload,
    CombatRoundLog,
    CombatStanceChoice,
    CombatTiePayload,
} from './combat-state.models';
import { MatchStateService } from './match-state.service';
import {
    createPendingRoundLog,
    createCombatPanelFighter,
    createResolvedRoundLog as buildResolvedRoundLog,
    createTieNotice,
    createVictoryNotice,
    getDamageTakenByFighterId,
    getCountdownSeconds,
    getCombatOrientation,
    getOrderedCombatPlayers,
    getTileTypeForCombatPlayer,
    isOpenDoorForCombatPlayer,
    resolveCombatParticipants,
    getUpdatedHealthByFighterId,
    upsertRoundLog,
} from './combat-state.utils';
const DICE_ROLL_DURATION_MS = 1000;
const ATTACK_POSE_DURATION_MS = 900;
const HIT_REACTION_DURATION_MS = 280;
const OUTCOME_RESOLUTION_GRACE_MS = 500;
const COMBAT_END_DEAD_FRAME_MS = 1000; const COMBAT_END_LINGER_MS = 1000;
const ROUND_RESOLUTION_DURATION_MS = DICE_ROLL_DURATION_MS + ATTACK_POSE_DURATION_MS + HIT_REACTION_DURATION_MS;
@Injectable({ providedIn: 'root' })
export class CombatStateService {
    readonly lastCombatUpdate = signal('');
    readonly lastCombatOutcome = signal<CombatOutcomeNotice | null>(null);
    readonly panelState = signal<CombatPanelState | null>(null);
    readonly endingNotice = signal<CombatOutcomeNotice | null>(null);
    readonly roundLogs = signal<CombatRoundLog[]>([]);
    readonly localSelectedStance = signal<CombatStanceChoice>(null);
    readonly hasActiveCombat = computed(() => this.panelState() !== null);
    readonly isResolvingRound = signal(false);
    readonly canSelectStance = computed(() => {
        const turnState = this.combatTurnState();
        const localPlayerId = this.matchStateService.localPlayer()?.id ?? null;
        return !this.isResolvingRound()
            && !this.endingNotice()
            && !!turnState
            && turnState.phase === 'active'
            && turnState.activePlayerId === localPlayerId;
    });
    readonly footerMessage = computed(() => {
        if (!this.hasActiveCombat()) {
            return '';
        }

        if (this.endingNotice()) {
            return 'Fin du combat.';
        }

        if (this.isResolvingRound()) {
            return 'Resolution du round en cours...';
        }

        if (!this.canSelectStance()) {
            return 'En attente du prochain choix de posture.';
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

    private readonly combatTurnState = signal<MatchTurnState | null>(null);
    private pendingOutcomeNotice: CombatOutcomeNotice | null = null;
    private animationTimeoutIds: number[] = [];
    constructor(
        private readonly matchStateService: MatchStateService,
        private readonly socketManager: SocketManagerService,
    ) {
        this.registerSocketListeners();
        effect(() => this.handleParticipantDeparture());
    }

    closeCombat(): void {
        this.resetCombatState();
    }
    selectStance(stance: Exclude<CombatStanceChoice, null>): void {
        const panelState = this.panelState();
        const localPlayerId = this.matchStateService.localPlayer()?.id ?? null;
        if (!panelState || !localPlayerId || !this.canSelectStance()) {
            return;
        }

        this.localSelectedStance.set(stance);
        this.syncPendingRoundLog();
        this.socketManager.send(CombatSocketEvents.SetStance, {
            combatId: panelState.id,
            playerId: localPlayerId,
            stance,
        } satisfies StancePayload);
    }
    private registerSocketListeners(): void {
        this.socketManager.on<MatchTurnState>(CombatSocketEvents.TurnSnapshot, (turnState) => this.handleTurnSnapshot(turnState));
        this.socketManager.on<CombatPlayerStatistics[]>(CombatSocketEvents.AttackSnapshot, (statistics) => this.handleAttackSnapshot(statistics));
        this.socketManager.on<CombatResultPayload>(CombatSocketEvents.Victory, (payload) => this.handleVictory(payload));
        this.socketManager.on<CombatTiePayload>(CombatSocketEvents.Tie, (payload) => this.handleTie(payload));
    }

    private handleTurnSnapshot(turnState: MatchTurnState): void {
        const match = this.matchStateService.match();
        const participants = match ? resolveCombatParticipants(match.players, turnState) : null;
        if (!participants) {
            return;
        }

        const currentPanelState = this.panelState();
        const currentHealthByFighterId = new Map(
            currentPanelState?.fighters.map((fighter) => [fighter.id, fighter.currentHealth]) ?? [],
        );
        const [attacker, defender] = participants;
        const orientation = getCombatOrientation(attacker, defender);
        const localPlayerId = this.matchStateService.localPlayer()?.id ?? null;
        const orderedPlayers = getOrderedCombatPlayers(attacker, defender, orientation);
        const isNewCombat = currentPanelState?.id !== turnState.matchId;
        const round = isNewCombat ? 1 : (currentPanelState?.round ?? 1);
        const previousFightersById = new Map(currentPanelState?.fighters.map((fighter) => [fighter.id, fighter]) ?? []);
        const fighters = orderedPlayers.map((player, index) =>
            createCombatPanelFighter({
                player,
                index,
                orientation,
                localPlayerId,
                currentHealth: currentHealthByFighterId.get(player.id) ?? player.health,
                previousFighter: previousFightersById.get(player.id) ?? null,
                tileType: getTileTypeForCombatPlayer(match, player),
                isDoorOpen: isOpenDoorForCombatPlayer(match, player),
                keepAnimatedPose: this.isResolvingRound(),
            }),
        ) as [CombatPanelFighter, CombatPanelFighter];

        if (isNewCombat) {
            this.clearAnimationTimers();
            this.pendingOutcomeNotice = null;
            this.endingNotice.set(null);
            this.isResolvingRound.set(false);
            this.roundLogs.set([]);
            this.localSelectedStance.set(null);
        }

        this.combatTurnState.set(turnState);
        this.panelState.set({
            id: turnState.matchId,
            attackerId: attacker.id,
            defenderId: defender.id,
            orientation,
            round,
            countdownSeconds: getCountdownSeconds(turnState),
            fighters,
        });
        if (!this.isResolvingRound()) {
            this.syncPendingRoundLog();
        }
    }

    private handleAttackSnapshot(statistics: CombatPlayerStatistics[]): void {
        const currentPanelState = this.panelState();
        if (!currentPanelState || statistics.length === 0) {
            return;
        }
        const resolvedRoundLog = buildResolvedRoundLog(currentPanelState, statistics);
        if (!resolvedRoundLog) {
            return;
        }

        const updatedHealthByFighterId = getUpdatedHealthByFighterId(statistics);
        const damageTakenByFighterId = getDamageTakenByFighterId(statistics);
        const resolvedFightersById = new Map(
            resolvedRoundLog.fighters.map((fighter) => [fighter.fighterId, fighter]),
        );
        this.roundLogs.update((roundLogs) => upsertRoundLog(roundLogs, resolvedRoundLog));

        this.clearAnimationTimers();
        this.isResolvingRound.set(true);
        this.localSelectedStance.set(null);
        this.panelState.update((panelState) => {
            if (!panelState) {
                return panelState;
            }
            return {
                ...panelState,
                fighters: panelState.fighters.map((fighter) => ({
                    ...fighter,
                    attackRollValue: resolvedFightersById.get(fighter.id)?.attack.dieValue ?? fighter.attackRollValue,
                    defenseRollValue: resolvedFightersById.get(fighter.id)?.defense.dieValue ?? fighter.defenseRollValue,
                    rollToken: fighter.rollToken + 1,
                    pose: PlayerPose.Idle,
                    isHit: false,
                })) as [CombatPanelFighter, CombatPanelFighter],
            };
        });

        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.panelState.update((panelState) => {
                if (!panelState) {
                    return panelState;
                }
                return {
                    ...panelState,
                    fighters: panelState.fighters.map((fighter) => ({
                        ...fighter,
                        pose: resolvedFightersById.get(fighter.id)?.stance === 'attack' ? PlayerPose.Attack : PlayerPose.Idle,
                    })) as [CombatPanelFighter, CombatPanelFighter],
                };
            });
        }, DICE_ROLL_DURATION_MS));

        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.panelState.update((panelState) => {
                if (!panelState) {
                    return panelState;
                }

                return {
                    ...panelState,
                    fighters: panelState.fighters.map((fighter) => {
                        const nextHealth = updatedHealthByFighterId.get(fighter.id) ?? fighter.currentHealth;
                        return {
                            ...fighter,
                            currentHealth: nextHealth,
                            pose: nextHealth <= 0 ? PlayerPose.Dead : PlayerPose.Idle,
                            isHit: (damageTakenByFighterId.get(fighter.id) ?? 0) > 0,
                        };
                    }) as [CombatPanelFighter, CombatPanelFighter],
                };
            });
        }, DICE_ROLL_DURATION_MS + ATTACK_POSE_DURATION_MS));

        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.finalizeRoundResolution();
        }, ROUND_RESOLUTION_DURATION_MS));
    }

    private handleVictory(payload: CombatResultPayload): void {
        const notice = createVictoryNotice(this.matchStateService.match()?.players ?? [], payload, false);
        if (notice) this.queueCombatOutcome(notice);
    }

    private handleTie(payload: CombatTiePayload): void {
        const notice = createTieNotice(this.matchStateService.match()?.players ?? [], payload);
        if (notice) this.queueCombatOutcome(notice);
    }

    private syncPendingRoundLog(): void {
        const panelState = this.panelState();
        if (!panelState || this.isResolvingRound()) {
            return;
        }

        const pendingRoundLog = createPendingRoundLog(panelState, this.localSelectedStance());
        this.roundLogs.update((roundLogs) => upsertRoundLog(roundLogs, pendingRoundLog));
    }

    private handleParticipantDeparture(): void {
        const panelState = this.panelState();
        const matchPlayers = this.matchStateService.match()?.players ?? [];
        const localPlayer = this.matchStateService.localPlayer();
        if (!panelState || !localPlayer) {
            return;
        }

        if (!matchPlayers.some((player) => player.id === localPlayer.id)) {
            this.resetCombatState();
            return;
        }

        const missingOpponent = panelState.fighters.find((fighter) =>
            fighter.id !== localPlayer.id && !matchPlayers.some((player) => player.id === fighter.id),
        );
        if (!missingOpponent) {
            return;
        }

        const localPlayerName = matchPlayers.find((player) => player.id === localPlayer.id)?.name ?? localPlayer.name;
        this.lastCombatOutcome.set({
            id: `${localPlayer.id}:${missingOpponent.id}:${Date.now()}`,
            attackerId: localPlayer.id,
            defenderId: missingOpponent.id,
            attackerMessage: `Victoire contre ${missingOpponent.name} par abandon.`,
            defenderMessage: `Defaite contre ${localPlayerName} par abandon.`,
            logMessage: `${missingOpponent.name} abandonne le combat.`,
        });
        this.lastCombatUpdate.set(`${missingOpponent.name} abandonne le combat.`);
        this.resetCombatState();
    }

    private resetCombatState(): void {
        this.clearAnimationTimers();
        this.pendingOutcomeNotice = null;
        this.endingNotice.set(null);
        this.isResolvingRound.set(false);
        this.combatTurnState.set(null);
        this.panelState.set(null);
        this.roundLogs.set([]);
        this.localSelectedStance.set(null);
    }

    private finalizeRoundResolution(): void {
        this.clearAnimationTimers();

        const pendingOutcomeNotice = this.pendingOutcomeNotice;
        this.pendingOutcomeNotice = null;
        this.isResolvingRound.set(false);

        if (pendingOutcomeNotice) {
            this.startCombatEnding(pendingOutcomeNotice);
            return;
        }
        this.panelState.update((panelState) =>
            panelState
                ? {
                    ...panelState,
                    round: panelState.round + 1,
                    fighters: panelState.fighters.map((fighter) => ({
                        ...fighter,
                        isHit: false,
                        pose: fighter.currentHealth <= 0 ? PlayerPose.Dead : PlayerPose.Idle,
                    })) as [CombatPanelFighter, CombatPanelFighter],
                }
                : panelState,
        );
        this.syncPendingRoundLog();
    }

    private clearAnimationTimers(): void {
        this.animationTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
        this.animationTimeoutIds = [];
    }

    private queueCombatOutcome(notice: CombatOutcomeNotice): void {
        if (!this.panelState()) {
            this.lastCombatOutcome.set(notice);
            this.lastCombatUpdate.set(notice.logMessage);
            this.resetCombatState();
            return;
        }

        const wasResolvingRound = this.isResolvingRound();
        this.pendingOutcomeNotice = notice;
        if (wasResolvingRound) {
            return;
        }
        this.isResolvingRound.set(true);
        this.animationTimeoutIds.push(window.setTimeout(() => {
            if (this.pendingOutcomeNotice?.id !== notice.id || this.endingNotice()) {
                return;
            }

            this.startCombatEnding(notice);
        }, OUTCOME_RESOLUTION_GRACE_MS));
    }

    private startCombatEnding(notice: CombatOutcomeNotice): void {
        this.combatTurnState.set(null);
        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.endingNotice.set(notice);
        }, COMBAT_END_DEAD_FRAME_MS));
        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.lastCombatOutcome.set(notice);
            this.lastCombatUpdate.set(notice.logMessage);
            this.resetCombatState();
        }, COMBAT_END_DEAD_FRAME_MS + COMBAT_END_LINGER_MS));
    }
}
