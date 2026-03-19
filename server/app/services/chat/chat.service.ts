import { GameSessionService } from '@app/services/game-session/game-session.service';
import { validateChatMessage } from '@common/chat/chat-validation.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class ChatService {
    constructor(private readonly gameSessionService: GameSessionService) {}

    addMessage(sessionId: string, socketId: string, content: string): ChatMessage | null {
        const playerName = this.gameSessionService.getPlayerNameForSocket(socketId, sessionId);
        if (!playerName) {
            return null;
        }

        const message: ChatMessage = {
            id: randomUUID(),
            author: playerName,
            content,
            createdAt: new Date().toISOString(),
        };

        if (!validateChatMessage(message)) {
            return null;
        }

        return this.gameSessionService.addChatMessage(sessionId, message);
    }
}
