import { createActiveTurnState, createTransitionTurnState } from '@app/services/game-session/game-session.runtime';
import { SNAPSHOT_TICK_MS } from '@app/utilities/game/game.constants';
import { Timers } from '@app/utilities/turn/turn.interface';
import { ActivePlayerGetter, TimerConfig, TurnCapableSession } from '@app/utilities/turn/turn.type';

export function startTimerTransition<TSession extends TurnCapableSession>(
    session: TSession,
    config: TimerConfig<TSession>,
): void {
    clearTimers(session);
    session.turnState = createTransitionTurnState(session.turnState);
    
    config.emitSnapshot(session);

    session.timerIntervalId = setInterval(() => {
        tickTimers(session, (candidate) => config.emitSnapshot(candidate));
    }, SNAPSHOT_TICK_MS);

    session.transitionTimeoutId = setTimeout(() => {
        config.onTransitionEnd(session);
    }, config.transitionDuration);
}

export function advanceToNextTurn<TSession extends TurnCapableSession>(
    session: TSession,
    beforeAdvance?: (session: TSession) => void,
): void {
    clearTimers(session);
    if (session.turnState.order.length === 0) {
        return;
    }

    if(beforeAdvance)
        beforeAdvance(session);

    session.turnState = {
        ...session.turnState,
        currentTurnIndex: (session.turnState.currentTurnIndex + 1) % session.turnState.order.length,
    };
}

export function activateTurn<TSession extends TurnCapableSession>(
    session: TSession,
    getActivePlayer: ActivePlayerGetter<TSession>,
    config: TimerConfig<TSession>,
): void {
    const activePlayer = getActivePlayer(session);
    if (!activePlayer) return;
    
    clearTimers(session);
    session.turnState = createActiveTurnState(session.turnState, activePlayer, config.transitionDuration);
    config.emitSnapshot(session);
    session.timerIntervalId = setInterval(() => tickTimers(session, (candidate) => config.emitSnapshot(candidate)), SNAPSHOT_TICK_MS);
    session.activeTurnTimeoutId = setTimeout(() => config.onTransitionEnd(session), config.transitionDuration);
}

export function tickTimers<T extends TurnCapableSession>(
    session: T,
    emitSnapshot: (session: T) => void,
): void {
    if (session.turnState.phase === 'transition' && session.turnState.transitionEndsAt !== null) {
        session.turnState = {
            ...session.turnState,
            transitionRemainingMs: Math.max(0, session.turnState.transitionEndsAt - Date.now()),
        };
        emitSnapshot(session);
        return;
    }

    if (session.turnState.phase === 'active' && session.turnState.activeTurnEndsAt !== null) {
        session.turnState = {
            ...session.turnState,
            activeTurnRemainingMs: Math.max(0, session.turnState.activeTurnEndsAt - Date.now()),
        };
        emitSnapshot(session);
    }
}

export function clearTurnState<TSession extends TurnCapableSession>(
    session: TSession,
): void {
    clearTimers(session);
    session.turnState = {
        ...session.turnState,
        phase: 'transition',
        activePlayerId: null,
        transitionTargetPlayerId: null,
        transitionEndsAt: null,
        transitionRemainingMs: 0,
        activeTurnEndsAt: null,
        activeTurnRemainingMs: 0,
        movementPointsRemaining: 0,
        actionTaken: true,
        playerStates: session.turnState.playerStates.map((playerState) => ({ ...playerState, state: 'waiting' })),
    };
}

export function clearTimers<T extends Timers>(session: T): void {
    if (session.transitionTimeoutId) {
        clearTimeout(session.transitionTimeoutId);
        session.transitionTimeoutId = null;
    }
    if (session.activeTurnTimeoutId) {
        clearTimeout(session.activeTurnTimeoutId);
        session.activeTurnTimeoutId = null;
    }
    if (session.timerIntervalId) {
        clearInterval(session.timerIntervalId);
        session.timerIntervalId = null;
    }
}

export function pauseTimer<TSession extends TurnCapableSession>(session: TSession): void {
    clearTimers(session);

    if (session.turnState.phase === 'active' && session.turnState.activeTurnEndsAt) {
        session.turnState.activeTurnRemainingMs =
            Math.max(0, session.turnState.activeTurnEndsAt - Date.now());
    }

    if (session.turnState.phase === 'transition' && session.turnState.transitionEndsAt) {
        session.turnState.transitionRemainingMs =
            Math.max(0, session.turnState.transitionEndsAt - Date.now());
    }

    session.turnState = {
        ...session.turnState,
        playerStates: session.turnState.playerStates.map(player => ({
            ...player,
            state: 'waiting',
        })),
    };
}

export function resumeTimers<TSession extends TurnCapableSession>(
    session: TSession,
    config: TimerConfig<TSession>,
): void {
    clearTimers(session);

    if (session.turnState.phase === 'active' && session.turnState.activeTurnEndsAt) {
        session.turnState.activeTurnEndsAt = Math.max(0, session.turnState.activeTurnRemainingMs + Date.now());
    }

    if (session.turnState.phase === 'transition' && session.turnState.transitionEndsAt) {
        session.turnState.transitionEndsAt = Math.max(0, session.turnState.transitionRemainingMs + Date.now());
    }

    session.turnState.playerStates = session.turnState.order.map((entry) => ({
            playerId: entry.playerId,
            state: entry.playerId === session.turnState.activePlayerId ? 'active' : 'waiting',
    }));

    config.emitSnapshot(session);
    session.timerIntervalId = setInterval(() => tickTimers(session, config.emitSnapshot), SNAPSHOT_TICK_MS);

    if(session.turnState.phase === 'active')
        session.activeTurnTimeoutId = setTimeout(() => config.onTransitionEnd(session), session.turnState.activeTurnRemainingMs);
    else if (session.turnState.phase === 'transition')
        session.transitionTimeoutId = setTimeout(() => config.onTransitionEnd(session), session.turnState.transitionRemainingMs);
}

