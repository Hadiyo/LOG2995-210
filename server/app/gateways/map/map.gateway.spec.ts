import { MapService } from '@app/services/map/map.service';
import { makeEditorMap } from '@app/services/map/map.service.spec-utils';
import { MapVisibilityEventPayload, SocketEvents, SocketRoom } from '@common/socket-events';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { MapGateway } from './map.gateway';

function createMockSocket(id: string) {
  const rooms = new Set<string>();
  return {
    id,
    rooms,
    join: jest.fn().mockImplementation((room: string) => rooms.add(room)),
    leave: jest.fn().mockImplementation((room: string) => rooms.delete(room)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as Socket;
}

describe('MapGateway', () => {
  let gateway: MapGateway;
  let mapService: MapService;
  let mockEmit: jest.Mock;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockEmit = jest.fn();
    const mockServer: Partial<Server> = {
      to: jest.fn().mockImplementation(() => ({
        emit: mockEmit,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapGateway,
        {
          provide: MapService,
          useValue: {
            on: jest.fn(),
            off: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<MapGateway>(MapGateway);
    mapService = module.get<MapService>(MapService);

    // To access private attribute server
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gateway as any).server = mockServer as Server;
    logSpy = jest.spyOn(gateway['logger'], 'log');
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should subscribe to all MapService events on initialisation', () => {
    expect(mapService.on).toHaveBeenCalledWith(SocketEvents.MapDeleted, expect.any(Function));
    expect(mapService.on).toHaveBeenCalledWith(SocketEvents.MapCreated, expect.any(Function));
    expect(mapService.on).toHaveBeenCalledWith(SocketEvents.ToogleMapVisibility, expect.any(Function));
    expect(mapService.on).toHaveBeenCalledWith(SocketEvents.MapUpdated, expect.any(Function));
  });

  it('should log on client connection', () => {
    const client = createMockSocket('socket-123');
    gateway.handleConnection(client);
    expect(logSpy).toHaveBeenCalledWith('Client socket-123 connected.');
  });

  it('should log on client disconnection', () => {
    const client = createMockSocket('socket-123');
    gateway.handleDisconnect(client);
    expect(logSpy).toHaveBeenCalledWith('Client socket-123 disconnected.');
  });

  it('subscribeMapDeleteHandler should emit MapDeleted event', () => {
    const handler = (mapService.on as jest.Mock).mock.calls.find(
      call => call[0] === SocketEvents.MapDeleted,
    )[1];

    handler('test-id');

    expect(gateway['server'].to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(gateway['server'].to(SocketRoom.MapManagementRoom).emit).toHaveBeenCalledWith(SocketEvents.MapDeleted, 'test-id');
  });

  it('subscribeMapCreateHandler should emit MapCreated event', () => {
    const map = makeEditorMap();
    const handler = (mapService.on as jest.Mock).mock.calls.find(
      call => call[0] === SocketEvents.MapCreated,
    )[1];

    handler(map);

    expect(gateway['server'].to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(gateway['server'].to(SocketRoom.MapManagementRoom).emit).toHaveBeenCalledWith(SocketEvents.MapCreated, map);
  });

  it('subscribeMapVisibilityHander should emit ToogleMapVisibility event', () => {
    const payload: MapVisibilityEventPayload = { id: '1', isVisible: false };
    const handler = (mapService.on as jest.Mock).mock.calls.find(
      call => call[0] === SocketEvents.ToogleMapVisibility,
    )[1];

    handler(payload);

    expect(gateway['server'].to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(gateway['server'].to(SocketRoom.MapManagementRoom).emit).toHaveBeenCalledWith(SocketEvents.ToogleMapVisibility, {
      id: payload.id,
      isVisible: payload.isVisible,
    });
  });

  it('subscribeMapEditHandler should emit MapUpdated event', () => {
    const map = makeEditorMap();
    const handler = (mapService.on as jest.Mock).mock.calls.find(
      call => call[0] === SocketEvents.MapUpdated,
    )[1];

    handler(map);

    expect(gateway['server'].to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(gateway['server'].to(SocketRoom.MapManagementRoom).emit).toHaveBeenCalledWith(SocketEvents.MapUpdated, map);
  });

  it('should unsubscribe all handlers on destroy', () => {
    gateway.onModuleDestroy();
    expect(mapService.off).toHaveBeenCalledWith(SocketEvents.MapDeleted, expect.any(Function));
    expect(mapService.off).toHaveBeenCalledWith(SocketEvents.MapCreated, expect.any(Function));
    expect(mapService.off).toHaveBeenCalledWith(SocketEvents.ToogleMapVisibility, expect.any(Function));
    expect(mapService.off).toHaveBeenCalledWith(SocketEvents.MapUpdated, expect.any(Function));
  });

  it('should handle joinRoom and leaveRoom', () => {
    const client = createMockSocket('socket1');

    gateway.joinRoom(SocketRoom.MapManagementRoom, client);
    expect(client.join).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(client.rooms.has(SocketRoom.MapManagementRoom)).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      `Client socket1 joined ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

  it('should handle leaveRoom', () => {
    const client = createMockSocket('socket1');
    gateway.leaveRoom(SocketRoom.MapManagementRoom, client);
    expect(client.leave).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(client.rooms.has(SocketRoom.MapManagementRoom)).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      `Client socket1 left ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

});
