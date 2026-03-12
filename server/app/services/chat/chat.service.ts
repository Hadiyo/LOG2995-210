import { validateChatMessage } from '@common/chat/chat-validation.utils';
import { ChatMessage, ChatPayload } from '@common/chat/chat.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
    /** HOLD ALL CHAT ROOMS AND THEIR REFERENCE TO THE GAME THEY ARE IN */
    private chatRooms = new Map<string, ChatMessage[]>();

    /**
     * Chat room is saved in chatRooms
     * @returns chatSessionId
     */
    saveChat(gameSessionId: string): string | null {
        this.chatRooms.set(gameSessionId, []);

        return gameSessionId;
    }

    loadChatMessages(gameSessionId: string): ChatMessage[] {
        return [...(this.chatRooms.get(gameSessionId) ?? [])];
    }

    sendMessage(payload: ChatPayload): boolean {
        const message = payload.message;

        if (!validateChatMessage(message)) { 
            return false 
        }

        const gameSessionId = payload.sessionId;

        if (!this.chatRooms.has(gameSessionId)) {
            return false;
        }

        this.chatRooms.get(gameSessionId)?.push(message);
        return true;
    }

    deleteChat(gameSessionId: string): void {
        this.chatRooms.delete(gameSessionId);
    }
}
