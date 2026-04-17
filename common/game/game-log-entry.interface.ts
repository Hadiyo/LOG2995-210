import { ChatMessage } from '@common/chat/chat.interface';

export interface GameLogEntry extends ChatMessage {
    involvedPlayers: string[];
}
