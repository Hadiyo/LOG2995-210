import { Injectable, signal } from '@angular/core';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import {
    MatchTurnOrderEntry,
    MatchTurnState,
    PlayerTurnInteractionState,
} from '@common/game/turn.interface';
import {
    buildPlayerStates,
    buildTurnOrderFromPlayers,
    clearWindowTimer,
    isReusableTurnState,
    normalizePersistedTurnState,
    readStoredJson,
} from './turn-state.helpers';

const TURN_STATE_STORAGE_KEY = 'pendingMatchTurnState';
const TURN_TRANSITION_DURATION_MS = 3000;
const TURN_ACTIVE_DURATION_MS = 30000;
const TURN_TICK_MS = 100;

type InteractionContext = 'default' | 'inspection';

@Injectable({ providedIn: 'root' })
export class TurnStateService {
    readonly turnState = signal<MatchTurnState | null>(
        normalizePersistedTurnState(readStoredJson<MatchTurnState>(TURN_STATE_STORAGE_KEY)),
    );

    private transitionTimerId: number | null = null;
    private activeTurnTimerId: number | null = null;

    buildTurnOrder(players: MatchPlayer[], random: () => number): MatchTurnOrderEntry[] {
        return buildTurnOrderFromPlayers(players, random);
    }

    initialize(match: InitializedMatch, random: () => number): void {
        const raw = readStoredJson<MatchTurnState>(TURN_STATE_STORAGE_KEY);
        if (raw && isReusableTurnState(raw, match)) {
            const currentState = this.turnState();
            if (currentState) {
                if (currentState.phase === 'active') {
                    this.startActiveTurnTimer();
                } else {
                    this.startTransitionTimer();
                }
                return;
            }
        }

        const order = buildTurnOrderFromPlayers(match.players, random);
        this.startTransition(match.mapId, order, 0, false);
    }

    advanceToNextTurn(): void {
        const currentState = this.turnState();
        if (!currentState) return;
        this.advanceFromExpiredTurn(currentState);
    }

    hydrateSnapshot(turnState: MatchTurnState | null): void {
        this.clearTransitionTimer();
        this.clearActiveTurnTimer();

        if (!turnState) {
            this.turnState.set(null);
            localStorage.removeItem(TURN_STATE_STORAGE_KEY);
            return;
        }

        this.setPersistedState(turnState);
    }

    canPlayerInteract(playerId: string, context: InteractionContext = 'default'): boolean {
        const currentState = this.turnState();
        if (!currentState) return false;
        if (context === 'inspection') return true;

        const playerState = this.getPlayerTurnState(currentState, playerId);
        if (currentState.phase !== 'active') {
            return false;
        }

        return currentState.activePlayerId === playerId && playerState === 'active';
    }

    canPerformMovement(playerId: string, cost: number = 0): boolean {
        const currentState = this.turnState();
        if (!currentState) return false;
        return this.canPlayerInteract(playerId) && currentState.movementPointsRemaining >= cost;
    }

    canPerformAction(playerId: string): boolean {
        const currentState = this.turnState();
        if (!currentState || currentState.actionTaken) return false;
        return this.canPlayerInteract(playerId);
    }

    recordMovement(playerId: string, cost: number): boolean {
        const currentState = this.turnState();
        if (!currentState || !this.canPerformMovement(playerId, cost)) return false;

        this.setPersistedState({
            ...currentState,
            movementPointsRemaining: currentState.movementPointsRemaining - cost,
            movementCount: currentState.movementCount + 1,
        });
        return true;
    }

    consumeAction(playerId: string): boolean {
        const currentState = this.turnState();
        if (!currentState || !this.canPerformAction(playerId)) return false;

        this.setPersistedState({
            ...currentState,
            actionTaken: true,
        });
        return true;
    }

    clear(): void {
        this.clearTransitionTimer();
        this.clearActiveTurnTimer();
        this.turnState.set(null);
        localStorage.removeItem(TURN_STATE_STORAGE_KEY);
    }

    removePlayer(playerId: string): void {
        const currentState = this.turnState();
        if (!currentState) return;

        const removedIndex = currentState.order.findIndex((entry) => entry.playerId === playerId);
        if (removedIndex === -1) return;

        const nextOrder = currentState.order.filter((entry) => entry.playerId !== playerId);
        if (nextOrder.length === 0) {
            this.clear();
            return;
        }

        const nextTurnIndex = removedIndex < currentState.currentTurnIndex
            ? currentState.currentTurnIndex - 1
            : removedIndex === currentState.currentTurnIndex
                ? currentState.currentTurnIndex % nextOrder.length
                : currentState.currentTurnIndex;
        const playerWasDrivingTurn = currentState.activePlayerId === playerId || currentState.transitionTargetPlayerId === playerId;

        if (playerWasDrivingTurn) {
            this.startTransition(currentState.matchId, nextOrder, nextTurnIndex, currentState.hasStarted);
            return;
        }

        this.setPersistedState({
            ...currentState,
            order: nextOrder,
            currentTurnIndex: nextTurnIndex,
            playerStates: currentState.playerStates.filter((entry) => entry.playerId !== playerId),
        });
    }

    private startTransition(matchId: string, order: MatchTurnOrderEntry[], currentTurnIndex: number, hasStarted: boolean): void {
        this.clearTransitionTimer();
        this.clearActiveTurnTimer();

        const transitionEndsAt = Date.now() + TURN_TRANSITION_DURATION_MS;
        this.setPersistedState({
            matchId,
            hasStarted,
            order,
            currentTurnIndex,
            phase: 'transition',
            activePlayerId: null,
            transitionTargetPlayerId: order[currentTurnIndex]?.playerId ?? null,
            transitionEndsAt,
            transitionRemainingMs: TURN_TRANSITION_DURATION_MS,
            activeTurnEndsAt: null,
            activeTurnRemainingMs: 0,
            movementPointsRemaining: 0,
            actionTaken: false,
            movementCount: 0,
            playerStates: buildPlayerStates(order),
        });
        this.startTransitionTimer();
    }

    private startTransitionTimer(): void {
        this.clearTransitionTimer();

        this.transitionTimerId = window.setInterval(() => {
            const currentState = this.turnState();
            if (!currentState || currentState.phase !== 'transition' || currentState.transitionEndsAt === null) {
                this.clearTransitionTimer();
                return;
            }

            const remainingMs = Math.max(0, currentState.transitionEndsAt - Date.now());
            if (remainingMs === 0) {
                this.activateTurn(currentState);
                return;
            }

            this.setPersistedState({
                ...currentState,
                transitionRemainingMs: remainingMs,
            });
        }, TURN_TICK_MS);
    }

    private activateTurn(currentState: MatchTurnState): void {
        this.clearTransitionTimer();

        const activePlayerId = currentState.order[currentState.currentTurnIndex]?.playerId ?? null;
        this.startActiveTurn({
            ...currentState,
            hasStarted: true,
            phase: 'active',
            activePlayerId,
            transitionTargetPlayerId: null,
            transitionEndsAt: null,
            transitionRemainingMs: 0,
            movementPointsRemaining: currentState.order[currentState.currentTurnIndex]?.speed ?? 0,
            actionTaken: false,
            movementCount: 0,
            playerStates: buildPlayerStates(currentState.order, activePlayerId),
        });
    }

    private startActiveTurn(currentState: MatchTurnState): void {
        this.clearActiveTurnTimer();

        const activeTurnEndsAt = Date.now() + TURN_ACTIVE_DURATION_MS;
        this.setPersistedState({
            ...currentState,
            phase: 'active',
            activeTurnEndsAt,
            activeTurnRemainingMs: TURN_ACTIVE_DURATION_MS,
        });
        this.startActiveTurnTimer();
    }

    private startActiveTurnTimer(): void {
        this.clearActiveTurnTimer();

        this.activeTurnTimerId = window.setInterval(() => {
            const currentState = this.turnState();
            if (!currentState || currentState.phase !== 'active' || currentState.activeTurnEndsAt === null) {
                this.clearActiveTurnTimer();
                return;
            }

            const remainingMs = Math.max(0, currentState.activeTurnEndsAt - Date.now());
            if (remainingMs === 0) {
                this.advanceFromExpiredTurn(currentState);
                return;
            }

            this.setPersistedState({
                ...currentState,
                activeTurnRemainingMs: remainingMs,
            });
        }, TURN_TICK_MS);
    }

    private advanceFromExpiredTurn(currentState: MatchTurnState): void {
        this.clearActiveTurnTimer();
        const nextTurnIndex = (currentState.currentTurnIndex + 1) % currentState.order.length;
        this.startTransition(currentState.matchId, currentState.order, nextTurnIndex, currentState.hasStarted);
    }

    private getPlayerTurnState(currentState: MatchTurnState, playerId: string): PlayerTurnInteractionState | null {
        return currentState.playerStates.find((entry) => entry.playerId === playerId)?.state ?? null;
    }

    private setPersistedState(state: MatchTurnState): void {
        this.turnState.set(state);
        localStorage.setItem(TURN_STATE_STORAGE_KEY, JSON.stringify(state));
    }

    private clearTransitionTimer(): void {
        this.transitionTimerId = clearWindowTimer(this.transitionTimerId);
    }

    private clearActiveTurnTimer(): void {
        this.activeTurnTimerId = clearWindowTimer(this.activeTurnTimerId);
    }
}
