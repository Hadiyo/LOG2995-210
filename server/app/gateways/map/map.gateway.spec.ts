import { MapGateway } from '@app/gateways/map/map.gateway';
import { MapService } from '@app/services/map/map.service';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { type EditorMap } from '@common/maps/map.interface';
import { MapVisibilityEventPayload, SocketEvents, SocketRoom } from '@common/socket-events';
import { Server, Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('MapGateway', () => {
  let gateway: MapGateway;
  // Create a mock for MapService with jest.fn() for the 'on' and 'off' methods
  let mapServiceMock: { on: jest.Mock; off: jest.Mock };
  // Handlers to capture the subscribed functions for later verification
  let mapDeletedHandler: ((id: string) => void) | undefined;
  // Handlers to capture the subscribed functions for later verification
  let mapCreatedHandler: ((map: EditorMap) => void) | undefined;
  let mapVisibilityHandler: (payload: MapVisibilityEventPayload) => void;
  let mapEditHandler: ((map: EditorMap) => void) | undefined;
  // Mock implementation for the 'on' method to capture event handlers
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const serverMock = { to } as unknown as Server;
  // let logSpy: jest.SpyInstance;

  function createMockSocket(id: string) {
    const rooms = new Set<string>();

    return {
      id,
      rooms,
      join: jest.fn((room: string) => rooms.add(room)),
      leave: jest.fn((room: string) => rooms.delete(room)),
    } as unknown as Socket;
  }

  const loggerMock = {
    log: jest.fn(),       // ✅ must be a function
  };


  // Set up the testing module before each test
  beforeEach(async () => {
    mapDeletedHandler = undefined;
    mapCreatedHandler = undefined;
    mapEditHandler = undefined;

    // Create a mock for MapService that captures the handlers for the events
    mapServiceMock = {
      // Mock the 'on' method to capture the handlers for the events
      on: jest.fn((event: SocketEvents, callback: (payload: unknown) => void) => {
        // Capture the handlers for the events so we can call them in our tests
        if (event === SocketEvents.MapDeleted) {
          mapDeletedHandler = callback as (id: string) => void;
        }
        if (event === SocketEvents.MapCreated) {
          mapCreatedHandler = callback as (map: EditorMap) => void;
        }
        if (event === SocketEvents.ToogleMapVisibility) {
          mapVisibilityHandler = callback as (payload: MapVisibilityEventPayload) => void;
        }
        if (event === SocketEvents.MapUpdated) {
          mapEditHandler = callback as (map: EditorMap) => void;
        }
      }),
      // Mock the 'off' method as a jest.fn() to verify that it's called on destroy
      off: jest.fn(),
    };

    // Create the testing module and inject the MapGateway with the mocked MapService
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapGateway,
        { provide: MapService, useValue: mapServiceMock },
        { provide: Logger, useValue: loggerMock },
      ],
    }).compile();

    // Get the instance of the MapGateway from the testing module
    gateway = module.get<MapGateway>(MapGateway);
    // Inject the server mock into the gateway instance
    (gateway as unknown as { server: Server }).server = serverMock;

    // Clear mocks before each test to ensure clean state
    emit.mockClear();
    to.mockClear();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  // Test that the gateway subscribes to map events on initialization
  it('subscribes to map events on init', () => {
    expect(mapServiceMock.on).toHaveBeenCalledWith(SocketEvents.MapDeleted, expect.any(Function));
    expect(mapServiceMock.on).toHaveBeenCalledWith(SocketEvents.MapCreated, expect.any(Function));
    expect(mapServiceMock.on).toHaveBeenCalledWith(SocketEvents.MapUpdated, expect.any(Function));
    expect(mapServiceMock.on).toHaveBeenCalledWith(SocketEvents.ToogleMapVisibility, expect.any(Function));
  });

  // Test that the gateway unsubscribes from map events on destroy
  it('forwards mapDeleted to mapManagementRoom', () => {
    expect(mapDeletedHandler).toBeDefined();
    // Simulate a map deletion event by calling the captured handler
    mapDeletedHandler?.('id-123');
    // Verify that the gateway emits the MapDeleted event to the MapManagementRoom with the correct payload
    expect(to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(emit).toHaveBeenCalledWith(SocketEvents.MapDeleted, 'id-123');
  });

  // Test that the gateway forwards mapCreated events to the MapManagementRoom
  it('forwards mapCreated to mapManagementRoom', () => {
    // Simulate a map creation event by calling the captured handler
    const createdMap: EditorMap = {
      id: 'map-1',
      name: 'Created map',
      description: 'desc',
      mode: GameMode.CLASSIC,
      size: MapSize.S,
      date: '2026-02-12T00:00:00.000Z',
      map: [],
      objects: [],
      visibility: true,
    };
    // Verify that the gateway emits the MapCreated event to the MapManagementRoom with the correct payload
    expect(mapCreatedHandler).toBeDefined();
    mapCreatedHandler?.(createdMap);

    expect(to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(emit).toHaveBeenCalledWith(SocketEvents.MapCreated, createdMap);
  });

  it('forward ToggleMapVisibility to MapManagement', () => {
    const payload = {
      id: 'mapId',
      isVisible: false,
    };
    expect(mapVisibilityHandler).toBeDefined();
    mapVisibilityHandler?.(payload);
    expect(to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(emit).toHaveBeenCalledWith(SocketEvents.ToogleMapVisibility, payload);
  });

  it('should forward updated Map to map management', () => {
    const updatedMap: EditorMap = {
      id: 'map-1',
      name: 'Created map',
      description: 'desc',
      mode: GameMode.CLASSIC,
      size: MapSize.S,
      date: '2026-02-12T00:00:00.000Z',
      map: [],
      objects: [],
      visibility: true,
    };
    // Verify that the gateway emits the MapCreated event to the MapManagementRoom with the correct payload
    expect(mapEditHandler).toBeDefined();
    mapEditHandler?.(updatedMap);

    expect(to).toHaveBeenCalledWith(SocketRoom.MapManagementRoom);
    expect(emit).toHaveBeenCalledWith(SocketEvents.MapUpdated, updatedMap);
  });

  it('should unsubscribe to all handlers if the gateway is destroyed', () => {
    gateway.onModuleDestroy();

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      SocketEvents.MapDeleted,
      expect.any(Function),
    );

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      SocketEvents.MapCreated,
      expect.any(Function),
    );

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      SocketEvents.ToogleMapVisibility,
      expect.any(Function),
    );

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      SocketEvents.MapUpdated,
      expect.any(Function),
    );
  });

  it('should log connection', () => {
    const client = createMockSocket('socket1');
    gateway.handleConnection(client);
    expect(loggerMock.log).toHaveBeenCalledWith('Client socket1 connected.');
  });

  it('should log disconnect', () => {
    const client = createMockSocket('socket1');
    gateway.handleDisconnect(client);
    expect(loggerMock.log).toHaveBeenCalledWith('Client socket1 disconnected.');
  });

  it('should handle joinRoom', () => {
    const client = createMockSocket('socket1');
    gateway.joinRoom(SocketRoom.MapManagementRoom, client);
    expect(loggerMock.log).toHaveBeenCalledWith(
      `Client socket1 joined ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

  it('should handle leaveRoom', () => {
    const client = createMockSocket('socket1');
    client.rooms.add(SocketRoom.MapManagementRoom);
    gateway.leaveRoom(SocketRoom.MapManagementRoom, client);
    expect(loggerMock.log).toHaveBeenCalledWith(
      `Client socket1 left ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

  it('joinRoom should not log when room is still not present after join', () => {
    const room = SocketRoom.MapManagementRoom;
    const client = {
      id: 'socket2',
      rooms: new Set<string>(), // stays empty
      join: jest.fn(), // does not add room
    } as unknown as Socket;

    gateway.joinRoom(room, client);

    expect(client.join).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket2 joined ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

  it('leaveRoom should not log when room is still present after leave', () => {
    const room = SocketRoom.MapManagementRoom;
    const client = {
      id: 'socket3',
      rooms: new Set<string>([room]), // remains in room
      leave: jest.fn(), // does not remove room
    } as unknown as Socket;

    gateway.leaveRoom(room, client);

    expect(client.leave).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket3 left ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

  it('onModuleDestroy should not unsubscribe when handlers are undefined', () => {
    (gateway as unknown as { mapDeletedHandler?: unknown }).mapDeletedHandler = undefined;
    (gateway as unknown as { mapCreateHandler?: unknown }).mapCreateHandler = undefined;
    (gateway as unknown as { mapVisibilityHandler?: unknown }).mapVisibilityHandler = undefined;
    (gateway as unknown as { mapEditHandler?: unknown }).mapEditHandler = undefined;

    gateway.onModuleDestroy();

    expect(mapServiceMock.off).not.toHaveBeenCalled();
  });

  it('constructor should use default logger when none is injected', () => {
    const serviceOnlyMock = { on: jest.fn(), off: jest.fn() } as unknown as MapService;
    const gatewayNoLogger = new MapGateway(serviceOnlyMock);
    expect(gatewayNoLogger).toBeDefined();
  });

});