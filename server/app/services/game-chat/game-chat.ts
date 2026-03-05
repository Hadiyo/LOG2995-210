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

    sendMessage(message: string, playerName: string, chatSessionId: string, timestamp: string): boolean {
        this.chatRooms.get(chatSessionId)?.push({
            senderName: playerName,
            message: message,
            timestamp: timestamp,
        });

        return true;
    }
}