import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';

export interface GameSessionRuntime {
    sessionId: string;
    match: InitializedMatch;
    turnState: MatchTurnState;
    messages: ChatMessage[];
    socketToPlayerId: Map<string, string>;
    transitionTimeoutId: NodeJS.Timeout | null;
    activeTurnTimeoutId: NodeJS.Timeout | null;
    timerIntervalId: NodeJS.Timeout | null;
}
