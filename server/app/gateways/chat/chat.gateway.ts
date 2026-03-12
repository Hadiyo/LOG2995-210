import { ChatService } from '@app/services/chat/chat.service';
import { ChatPayload } from '@common/chat/chat.interface';
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

  constructor(private readonly gameChatService: ChatService) {
    this.logger = new Logger(ChatGateway.name);
  }
  
  @SubscribeMessage(ChatSocketEvents.SendMessage)
  sendMessage(@MessageBody() payload: ChatPayload, @ConnectedSocket() client: Socket) {
    if (this.gameChatService.sendMessage(payload)) {
      this.server.to(payload.sessionId).emit(ChatSocketEvents.ReceiveMessage, payload);
    }
    else {
      this.logger.error('Failed to send message');
      client.emit(ChatSocketEvents.ChatServerError, 'Failed to send message');
    }
  }
}
