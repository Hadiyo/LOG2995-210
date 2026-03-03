import { RoomSocketEvents, SocketRoom } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
@WebSocketGateway()
export class RoomManagerGateway {
  @WebSocketServer() private server: Server;

  constructor(private readonly logger: Logger = new Logger(RoomManagerGateway.name)) {}

  @SubscribeMessage(RoomSocketEvents.JoinRoom)
  joinRoom(@MessageBody() room: SocketRoom, @ConnectedSocket() client: Socket) {
    client.join(room);
    if (client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} joined ${room} successfully`);
    }
  }

  @SubscribeMessage(RoomSocketEvents.LeaveRoom)
  leaveRoom(@MessageBody() room: SocketRoom, @ConnectedSocket() client: Socket) {
    client.leave(room);
    if (!client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} left ${room} successfully`);
    }
  }
}
