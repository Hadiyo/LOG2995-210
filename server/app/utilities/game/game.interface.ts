import { Timers } from '@app/utilities/turn/turn.interface';
import { ChatMessage } from '@common/chat/chat.interface';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import { InitializedMatch } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';

export interface GameSessionLogEntry {
    entry: GameLogEntry;
    visibleToPlayerIds: string[] | null;
}

export interface GameSessionRuntime extends Timers {
    sessionId: string;
    match: InitializedMatch;
    messages: ChatMessage[];
    logEntries: GameSessionLogEntry[];
    socketToPlayerId: Map<string, string>;
    turnState: MatchTurnState;
    virtualDecisionTimeoutId: NodeJS.Timeout | null;
}
