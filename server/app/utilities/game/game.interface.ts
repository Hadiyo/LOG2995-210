import { Timers } from '@app/utilities/turn/turn.interface';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';

export interface GameSessionRuntime extends Timers {
    sessionId: string;
    match: InitializedMatch;
    messages: ChatMessage[];
    socketToPlayerId: Map<string, string>;
    turnState: MatchTurnState;
    virtualDecisionTimeoutId: NodeJS.Timeout | null;
}
