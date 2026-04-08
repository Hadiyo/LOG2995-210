import { CombatSession } from '@app/utilities/combat/combat.interface';
import { GameSessionRuntime } from '@app/utilities/game/game.interface';

export function tickGameSessionTimers<T extends GameSessionRuntime | CombatSession>(
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

export function clearGameSessionTimers(session: GameSessionRuntime | CombatSession): void {
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
