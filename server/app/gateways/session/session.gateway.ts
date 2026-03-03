import { RoomSocketEvents, SocketRoom } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
@WebSocketGateway()
export class SessionGateway {
  private readonly mapSessionRoom: SocketRoom = SocketRoom.MapManagementRoom;

  constructor(private readonly logger: Logger = new Logger(SessionGateway.name)) {}

  @SubscribeMessage(RoomSocketEvents.JoinSessionRoom)
  joinSession(@ConnectedSocket() client: Socket) {
    client.join(this.mapSessionRoom);
    if (client.rooms.has(this.mapSessionRoom)) {
      this.logger.log(`Client ${client.id} joined ${this.mapSessionRoom} successfully`);
    }
  }

  @SubscribeMessage(RoomSocketEvents.LeaveSessionRoom)
  leaveSession(@ConnectedSocket() client: Socket) {
    client.leave(this.mapSessionRoom);
    if (!client.rooms.has(this.mapSessionRoom)) {
      this.logger.log(`Client ${client.id} left ${this.mapSessionRoom} successfully`);
    }
  }

  // @SubscribeMessage(RoomSocketEvents.JoinGameRoom)
  // joinGameRoom(@MessageBody() gameId: string, @ConnectedSocket() client: Socket) {

  // }

}
