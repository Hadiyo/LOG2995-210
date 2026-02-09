import { SocketEvents, SocketRoom } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class MapGateway {
  @WebSocketServer() private server: Server;

  constructor(private readonly logger: Logger) {}

  @SubscribeMessage(SocketEvents.JoinRoom)
  joinRoom(@ConnectedSocket() client: Socket, @MessageBody() room: SocketRoom) {
    client.join(room);
    if (client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} joined room successfully`);
    }
  }

  @SubscribeMessage(SocketEvents.LeaveRoom)
  leaveRoom(@MessageBody() room: SocketRoom, @ConnectedSocket() client: Socket) {
    client.leave(room);
    if (!client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} left room successfully`);
    }
  }
}
