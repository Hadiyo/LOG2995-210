import { MapService } from '@app/services/map/map.service';
import { EditorMap } from '@common/maps/map.interface';
import { MapSocketEvents, MapVisibilityEventPayload, SocketRoom } from '@common/socket-events';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
export class MapGateway implements OnModuleDestroy {
  @WebSocketServer() private server: Server;

  private mapDeletedHandler: (id: string) => void;
  private mapCreateHandler: (newMap: EditorMap) => void;
  private mapVisibilityHandler: (payload: MapVisibilityEventPayload) => void;
  private mapEditHandler: (map: EditorMap) => void;

  constructor(
    private readonly mapService: MapService,
    private readonly logger: Logger = new Logger(MapGateway.name)) {
    this.subscribeToAllHandlers();
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

  private subscribeMapDeleteHandler() {
    this.mapDeletedHandler = (id: string) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(MapSocketEvents.MapDeleted, id);
    };
    this.mapService.on(MapSocketEvents.MapDeleted, this.mapDeletedHandler);
  }

  private subscribeMapCreateHandler() {
    this.mapCreateHandler = (newMap: EditorMap) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(MapSocketEvents.MapCreated, newMap);
    };
    this.mapService.on(MapSocketEvents.MapCreated, this.mapCreateHandler);
  }

  private subscribeMapVisbilityHandler() {
    this.mapVisibilityHandler = (payload: MapVisibilityEventPayload) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(MapSocketEvents.ToogleMapVisibility, {
        id: payload.id,
        isVisible: payload.isVisible,
      });
    };
    this.mapService.on(MapSocketEvents.ToogleMapVisibility, this.mapVisibilityHandler);
  }

  private subscribeMapEditHandler() {
    this.mapEditHandler = (map: EditorMap) => {
      this.server.to(SocketRoom.MapManagementRoom).emit(MapSocketEvents.MapUpdated, map);
    };
    this.mapService.on(MapSocketEvents.MapUpdated, this.mapEditHandler);
  }

  private subscribeToAllHandlers() {
    this.subscribeMapDeleteHandler();
    this.subscribeMapCreateHandler();
    this.subscribeMapVisbilityHandler();
    this.subscribeMapEditHandler();
  }

  private unsubscribeAllHandlers() {
    if (this.mapDeletedHandler) {
      this.mapService.off(MapSocketEvents.MapDeleted, this.mapDeletedHandler);
    }
    if (this.mapCreateHandler) {
      this.mapService.off(MapSocketEvents.MapCreated, this.mapCreateHandler);
    }
    if (this.mapVisibilityHandler) {
      this.mapService.off(MapSocketEvents.ToogleMapVisibility, this.mapVisibilityHandler);
    }
    if (this.mapEditHandler) {
      this.mapService.off(MapSocketEvents.MapUpdated, this.mapEditHandler);
    }
  }

}
