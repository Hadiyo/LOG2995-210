import { ChatMessage } from '@common/game/game-session.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameChatService {
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

    getChatHistory(sessionId: string): ChatMessage[] {
        return this.chatRooms.get(sessionId);
    }

    sendMessage(message: ChatMessage, gameSessionId: string): boolean {
        if (!this.chatRooms.has(gameSessionId)) {
            return false;
        }

        this.chatRooms.get(gameSessionId)?.push(message);

        return true;
    }
}