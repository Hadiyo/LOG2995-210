import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { ChatSocketEvents } from '@common/socket-events';
import { getGameSessionRoom } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/api' })
export class ChatGateway {
    @WebSocketServer() private readonly server: Server;
    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly chatService: ChatService,
        private readonly gameSessionService: GameSessionService,
    ) {}

    @SubscribeMessage(ChatSocketEvents.SendMessage)
    public sendMessage(
        @MessageBody() message: ChatMessage,
        @ConnectedSocket() client: Socket,
    ): void {
        const sessionId = this.gameSessionService.findSessionIdForSocket(client.id);
        if (!sessionId) {
            this.logger.error(`No session found for socket ${client.id}`);
            client.emit(ChatSocketEvents.ChatServerError, 'Failed to send message');
            return;
        }

        const stored = this.chatService.addMessage(sessionId, client.id, message.content);
        if (!stored) {
            client.emit(ChatSocketEvents.ChatServerError, 'Failed to send message');
            return;
        }

        this.server.to(getGameSessionRoom(sessionId)).emit(ChatSocketEvents.ReceiveMessage, stored);
    }
}
