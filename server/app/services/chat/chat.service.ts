import { GameSessionService } from '@app/services/session/game-session.service';
import { validateChatMessage } from '@common/chat/chat-validation.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class ChatService {
    constructor (private readonly gameSessionService: GameSessionService) {};

    addMessage(message: ChatMessage, sessionId: string): ChatMessage | undefined {
        const session = this.gameSessionService.gameSessions.get(sessionId);
        if (!session) {
            return undefined;
        }

        if (!validateChatMessage(message)) {
            return undefined;
        }

        message.id = randomUUID();

        session.messages.push(message);
        return message;
    }
}
