import { ChatService } from '@app/services/chat/chat.service';
import { PlayerService } from '@app/services/player/player.service';
import { GameSessionService } from '@app/services/session/game-session.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { ChatSocketEvents } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
export class ChatGateway {
  @WebSocketServer()
  private server: Server;
  private readonly logger: Logger;

  constructor(
    private readonly chatService: ChatService,
    private readonly gameSessionService: GameSessionService,
    private readonly playerService: PlayerService,
  ) {
    this.logger = new Logger(ChatGateway.name);
  }
  
  @SubscribeMessage(ChatSocketEvents.SendMessage)
  sendMessage(@MessageBody() message: ChatMessage, @ConnectedSocket() client: Socket) {
    const internalPlayer = this.playerService.getPlayerBySocketId(client.id);
    const sessionId = this.gameSessionService.findPlayerInGameSession(internalPlayer.player.id);

    if (this.chatService.addMessage(message, sessionId)) {
      this.server.to(sessionId).emit(ChatSocketEvents.ReceiveMessage, message);
    }
    else {
      this.logger.error('Failed to send message');
      client.emit(ChatSocketEvents.ChatServerError, 'Failed to send message');
    }
  }
}
