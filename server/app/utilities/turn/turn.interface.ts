import { MatchTurnState } from '@common/game/turn.interface';

export interface Timers {
    transitionTimeoutId: NodeJS.Timeout | null;
    activeTurnTimeoutId: NodeJS.Timeout | null;
    timerIntervalId: NodeJS.Timeout | null;
}

export interface HasTurnState {
    turnState: MatchTurnState;
}
