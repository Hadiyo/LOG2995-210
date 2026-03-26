import { GameSessionService } from '@app/services/game-session/game-session.service';
import { validateChatMessage } from '@common/chat/chat-validation.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class ChatService {
    constructor(private readonly gameSessionService: GameSessionService) {}

    createMessage(author: string, content: string, maxContentLength?: number): ChatMessage | null {
        const normalizedContent = typeof maxContentLength === 'number'
            ? content.trim().slice(0, maxContentLength)
            : content.trim();

        if (!normalizedContent) {
            return null;
        }

        return {
            id: randomUUID(),
            author,
            content: normalizedContent,
            createdAt: new Date().toISOString(),
        };
    }

    addMessage(sessionId: string, socketId: string, content: string): ChatMessage | null {
        const playerName = this.gameSessionService.getPlayerNameForSocket(socketId, sessionId);
        if (!playerName) {
            return null;
        }

        const message = this.createMessage(playerName, content);
        if (!message || !validateChatMessage(message)) {
            return null;
        }

        return this.gameSessionService.addChatMessage(sessionId, message);
    }
}
