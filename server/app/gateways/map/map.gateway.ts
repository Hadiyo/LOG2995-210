import { MapService } from '@app/services/map/map.service';
import { EditorMap } from '@common/interface';
import { MapVisibilityEventPayload, SocketEvents, SocketRoom } from '@common/socket-events';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
export class MapGateway implements OnModuleDestroy {
  @WebSocketServer() private server: Server;

  private readonly logger = new Logger(MapGateway.name);
  private mapDeletedHandler: (id: string) => void;
  private mapCreateHandler: (newMap: EditorMap) => void;
  private mapVisibilityHandler: (payload: MapVisibilityEventPayload) => void;
  private mapEditHandler: (map: EditorMap) => void;

  constructor(private readonly mapService: MapService) {
    // Subscribes once to mapService event emitter by SocketEvent
    this.subscribeMapDeleteHandler();
    this.subscribeMapCreateHandler();
    this.subscribeMapVisbilityHandler();
    this.subscribeMapEditHandler();
  }

  onModuleDestroy() {
    this.unsubscribeAllHandlers();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client ${client.id} connected.`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected.`);
  }

  @SubscribeMessage(SocketEvents.JoinRoom)
  joinRoom(@MessageBody() room: SocketRoom, @ConnectedSocket() client: Socket) {
    client.join(room);
    if (client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} joined ${room} successfully`);
    }
  }

  @SubscribeMessage(SocketEvents.LeaveRoom)
  leaveRoom(@MessageBody() room: SocketRoom, @ConnectedSocket() client: Socket) {
    client.leave(room);
    if (!client.rooms.has(room)) {
      this.logger.log(`Client ${client.id} left ${room} successfully`);
    }
  }

  private subscribeMapDeleteHandler() {
    this.mapDeletedHandler = (id: string) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(SocketEvents.MapDeleted, id);
    };
    this.mapService.on(SocketEvents.MapDeleted, this.mapDeletedHandler);
  }

  private subscribeMapCreateHandler() {
    this.mapCreateHandler = (newMap: EditorMap) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(SocketEvents.MapCreated, newMap);
    };
    this.mapService.on(SocketEvents.MapCreated, this.mapCreateHandler);
  }

  private subscribeMapVisbilityHandler() {
    this.mapVisibilityHandler = (payload: MapVisibilityEventPayload) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(SocketEvents.ToogleMapVisibility, {
        id: payload.id,
        visibility: payload.visibility,
      });
    };
    this.mapService.on(SocketEvents.ToogleMapVisibility, this.mapVisibilityHandler);
  }

  private subscribeMapEditHandler() {
    this.mapEditHandler = (map: EditorMap) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(SocketEvents.MapUpdated, map);
    };
    this.mapService.on(SocketEvents.MapUpdated, this.mapEditHandler);
  }

  private unsubscribeAllHandlers() {
    if (this.mapDeletedHandler) {
      this.mapService.off(SocketEvents.MapDeleted, this.mapDeletedHandler);
    }
    if (this.mapCreateHandler) {
      this.mapService.off(SocketEvents.MapCreated, this.mapCreateHandler);
    }
    if (this.mapVisibilityHandler) {
      this.mapService.off(SocketEvents.ToogleMapVisibility, this.mapVisibilityHandler);
    }
    if (this.mapEditHandler) {
      this.mapService.off(SocketEvents.MapUpdated, this.mapEditHandler);
    }
  }

}
