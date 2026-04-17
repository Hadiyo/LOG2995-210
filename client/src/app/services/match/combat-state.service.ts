import { computed, effect, Injectable, signal } from '@angular/core';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { CombatPlayerStatistics, CombatWaitingSnapshot, StancePayload } from '@common/combat/combat.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { CombatSocketEvents, SessionSocketEvents } from '@common/socket-events';
import {
    COMBAT_ATTACK_POSE_DURATION_MS,
    COMBAT_DICE_ROLL_DURATION_MS,
    COMBAT_END_DEAD_FRAME_MS,
    COMBAT_END_LINGER_MS,
    COMBAT_OUTCOME_RESOLUTION_GRACE_MS,
    COMBAT_ROUND_RESOLUTION_DURATION_MS,
} from './combat-state.constants';
import {
    CombatOutcomeNotice,
    CombatPanelState,
    CombatResultPayload,
    CombatRoundLog,
    CombatStanceChoice,
    CombatTiePayload,
    CombatWaitingState,
} from './combat-state.models';
import {
    advanceCombatRoundState,
    applyResolvedDamageState,
    applyResolvedDiceState,
    applyResolvedStanceAnimationState,
    buildCombatPanelStateFromTurnSnapshot,
    createCombatForfeitNotice,
    createCombatWaitingState,
    getCombatFooterMessage,
} from './combat-state.reducers';
import {
    createResolvedRoundLog as buildResolvedRoundLog,
    createPendingRoundLog,
    createTieNotice,
    createVictoryNotice,
    getDamageTakenByFighterId,
    getUpdatedHealthByFighterId,
    revealRoundLog,
    upsertRoundLog,
} from './combat-state.utils';
import { MatchStateService } from './match-state.service';

@Injectable({ providedIn: 'root' })
export class CombatStateService {
    readonly lastCombatUpdate = signal('');
    readonly lastCombatOutcome = signal<CombatOutcomeNotice | null>(null);
    readonly panelState = signal<CombatPanelState | null>(null);
    readonly waitingState = signal<CombatWaitingState | null>(null);
    readonly endingNotice = signal<CombatOutcomeNotice | null>(null);
    readonly roundLogs = signal<CombatRoundLog[]>([]);
    readonly localSelectedStance = signal<CombatStanceChoice>(null);
    readonly hasActiveCombat = computed(() => this.panelState() !== null);
    readonly hasWaitingCombat = computed(() => {
        const waitingState = this.waitingState();
        const localPlayerId = this.matchStateService.localPlayer()?.id ?? null;
        const currentSessionId = this.gameSessionSocket.sessionId();
        return !!waitingState
            && waitingState.gameSessionId === currentSessionId
            && !this.hasActiveCombat()
            && waitingState.attackerId !== localPlayerId
            && waitingState.defenderId !== localPlayerId;
    });
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
    readonly timerLabel = computed(() => {
        const turnState = this.combatTurnState();
        const panelState = this.panelState();
        if (!turnState || !panelState) {
            return '';
        }
        if (turnState.phase === 'transition') {
            return 'Résolution du tour';
        }
        const activeFighter = panelState.fighters.find((fighter) => fighter.id === turnState.activePlayerId) ?? null;
        if (activeFighter?.isLocal) {
            return 'Votre tour';
        }
        return 'Tour de l’adversaire';
    });
    readonly footerMessage = computed(() => getCombatFooterMessage({
        canSelectStance: this.canSelectStance(),
        endingNotice: this.endingNotice(),
        hasActiveCombat: this.hasActiveCombat(),
        isResolvingRound: this.isResolvingRound(),
        selectedStance: this.localSelectedStance(),
    }));

    private readonly combatTurnState = signal<MatchTurnState | null>(null);
    private pendingOutcomeNotice: CombatOutcomeNotice | null = null;
    private animationTimeoutIds: number[] = [];
    constructor(
        private readonly gameSessionSocket: GameSessionSocketService,
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
        this.socketManager.on<CombatWaitingSnapshot>(SessionSocketEvents.CombatWaitingSnapshot, (snapshot) => this.handleWaitingSnapshot(snapshot));
        this.socketManager.on<CombatResultPayload>(SessionSocketEvents.ClientDisconnect, () => this.clearWaitingCombat());
        this.socketManager.on<CombatResultPayload>(SessionSocketEvents.CombatVictory, () => this.clearWaitingCombat());
        this.socketManager.on<CombatTiePayload>(SessionSocketEvents.CombatTie, () => this.clearWaitingCombat());
    }

    private handleTurnSnapshot(turnState: MatchTurnState): void {
        const match = this.matchStateService.match();
        if (!match) {
            return;
        }
        const localPlayerId = this.matchStateService.localPlayer()?.id ?? null;
        const currentPanelState = this.panelState();
        const isNewCombat = currentPanelState?.id !== turnState.matchId;
        const nextPanelState = buildCombatPanelStateFromTurnSnapshot({
            currentPanelState,
            keepAnimatedPose: this.isResolvingRound(),
            localPlayerId,
            match,
            turnState,
        });
        if (!nextPanelState) {
            return;
        }

        if (isNewCombat) {
            this.clearAnimationTimers();
            this.pendingOutcomeNotice = null;
            this.endingNotice.set(null);
            this.isResolvingRound.set(false);
            this.roundLogs.set([]);
            this.localSelectedStance.set(null);
        }

        this.combatTurnState.set(turnState);
        this.clearWaitingCombat();
        this.panelState.set(nextPanelState);
        if (!this.isResolvingRound()) {
            this.syncPendingRoundLog();
        }
    }

    private handleWaitingSnapshot(snapshot: CombatWaitingSnapshot): void {
        if (snapshot.gameSessionId !== this.gameSessionSocket.sessionId()) {
            return;
        }
        const players = this.matchStateService.match()?.players ?? [];
        if (!players.some((player) => player.id === snapshot.attackerId) || !players.some((player) => player.id === snapshot.defenderId)) {
            return;
        }
        this.waitingState.set(createCombatWaitingState(snapshot, players));
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
        this.roundLogs.update((roundLogs) => upsertRoundLog(roundLogs, resolvedRoundLog));

        this.clearAnimationTimers();
        this.isResolvingRound.set(true);
        this.localSelectedStance.set(null);
        this.panelState.update((panelState) => panelState ? applyResolvedDiceState(panelState, resolvedRoundLog) : panelState);

        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.panelState.update((panelState) => panelState ? applyResolvedStanceAnimationState(panelState, resolvedRoundLog) : panelState);
        }, COMBAT_DICE_ROLL_DURATION_MS));

        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.panelState.update((panelState) =>
                panelState ? applyResolvedDamageState(panelState, damageTakenByFighterId, updatedHealthByFighterId) : panelState,
            );
        }, COMBAT_DICE_ROLL_DURATION_MS + COMBAT_ATTACK_POSE_DURATION_MS));

        this.animationTimeoutIds.push(window.setTimeout(() => {
            this.finalizeRoundResolution();
        }, COMBAT_ROUND_RESOLUTION_DURATION_MS));
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
        const hasExistingLogs = this.roundLogs().length > 0;
        if (!panelState || this.isResolvingRound() || (hasExistingLogs && this.localSelectedStance() === null)) {
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
        const notice = createCombatForfeitNotice(localPlayer, matchPlayers, panelState);
        if (!notice) {
            return;
        }
        this.lastCombatOutcome.set(notice);
        this.lastCombatUpdate.set(notice.logMessage);
        this.resetCombatState();
    }

    private resetCombatState(): void {
        this.clearAnimationTimers();
        this.pendingOutcomeNotice = null;
        this.clearWaitingCombat();
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
        const currentRound = this.panelState()?.round ?? null;
        if (currentRound !== null) {
            this.roundLogs.update((roundLogs) => revealRoundLog(roundLogs, currentRound));
        }

        if (pendingOutcomeNotice) {
            this.startCombatEnding(pendingOutcomeNotice);
            return;
        }
        this.panelState.update((panelState) => panelState ? advanceCombatRoundState(panelState) : panelState);
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
        }, COMBAT_OUTCOME_RESOLUTION_GRACE_MS));
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

    private clearWaitingCombat(): void {
        this.waitingState.set(null);
    }
}
