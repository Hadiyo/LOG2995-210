import { pageRoomMap } from '@app/gateways/rooms.record';
import { PageContext, PageSocketEvents } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
* This gateway connects clients to page-specific socket rooms, ensuring they only receive information 
* relevant to the page they are viewing. The client only provides the page context it wishes to join 
* and does not know the underlying room details.
 */

@WebSocketGateway({
  namespace: '/api',
})
@WebSocketGateway()
export class PageRoomGateway {
  @WebSocketServer() server: Server;

  constructor(private readonly logger: Logger = new Logger(PageRoomGateway.name)) {}

  @SubscribeMessage(PageSocketEvents.JoinPage)
  joinPage(@ConnectedSocket() client: Socket, @MessageBody() payload: { page: PageContext }) {
    const room = pageRoomMap[payload.page];
    if (!room) return;
    client.join(room);
    if (client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} joined ${room} successfully`);
    }
  }

  @SubscribeMessage(PageSocketEvents.LeavePage)
  leavePage(@ConnectedSocket() client: Socket, @MessageBody() payload: { page: PageContext }) {
    const room = pageRoomMap[payload.page];
    if (!room) return;
    client.leave(room);
    if (!client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} left ${room} successfully`);
    }
  }
}