import { GameSessionRuntime } from './game-session.runtime';

export function tickGameSessionTimers(
    session: GameSessionRuntime,
    emitSnapshot: (session: GameSessionRuntime) => void,
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

export function clearGameSessionTimers(session: GameSessionRuntime): void {
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
    if (session.virtualDecisionTimeoutId) {
        clearTimeout(session.virtualDecisionTimeoutId);
        session.virtualDecisionTimeoutId = null;
    }
}
