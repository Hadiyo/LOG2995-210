import { HasTurnState, Timers } from '@app/utilities/turn/turn.interface';
import { MatchPlayer } from '@common/game/match.interface';

export type TurnCapableSession = Timers & HasTurnState;

export type TimerConfig<TSession> = {
    emitSnapshot: (session: TSession) => void;
    onTransitionEnd: (session: TSession) => void;
    transitionDuration: number;
};

export type ActivePlayerGetter<TSession> = (session: TSession) => MatchPlayer | null;