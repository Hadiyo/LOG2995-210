import { MapGateway } from '@app/gateways/map/map.gateway';
import { PageRoom } from '@app/gateways/rooms.record';
import { MapService } from '@app/services/map/map.service';
import { createMockLogger, createMockServer, createMockSocket } from '@app/utilities/mocks/mocks';
import { GameMode, MapSize } from '@common/maps/map.enums';
import type { EditorMap, MapSummary } from '@common/maps/map.interface';
import { MapSocketEvents, MapVisibilityEventPayload } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';

describe('MapGateway', () => {
  let gateway: MapGateway;
  let mapServiceMock: { on: jest.Mock; off: jest.Mock };
  let mapDeletedHandler: ((id: string) => void) | undefined;
  let mapCreatedHandler: ((map: EditorMap) => void) | undefined;
  let mapVisibilityHandler: (payload: MapVisibilityEventPayload) => void;
  let mapEditHandler: ((map: EditorMap) => void) | undefined;
  const server = createMockServer();
  const loggerMock = createMockLogger();

  beforeEach(async () => {
    jest.clearAllMocks();
    mapDeletedHandler = undefined;
    mapCreatedHandler = undefined;
    mapEditHandler = undefined;

    mapServiceMock = {
      on: jest.fn((event: MapSocketEvents, callback: (payload: unknown) => void) => {
        if (event === MapSocketEvents.MapDeleted) {
          mapDeletedHandler = callback as (id: string) => void;
        }
        if (event === MapSocketEvents.MapCreated) {
          mapCreatedHandler = callback as (map: EditorMap) => void;
        }
        if (event === MapSocketEvents.ToggleMapVisibility) {
          mapVisibilityHandler = callback as (payload: MapVisibilityEventPayload) => void;
        }
        if (event === MapSocketEvents.MapUpdated) {
          mapEditHandler = callback as (map: EditorMap) => void;
        }
      }),
      off: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapGateway,
        { provide: MapService, useValue: mapServiceMock },
        { provide: Logger, useValue: loggerMock },
      ],
    }).compile();

    gateway = module.get<MapGateway>(MapGateway);
    gateway['server'] = server as unknown as Server;

  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('subscribes to map events on init', () => {
    expect(mapServiceMock.on).toHaveBeenCalledWith(MapSocketEvents.MapDeleted, expect.any(Function));
    expect(mapServiceMock.on).toHaveBeenCalledWith(MapSocketEvents.MapCreated, expect.any(Function));
    expect(mapServiceMock.on).toHaveBeenCalledWith(MapSocketEvents.MapUpdated, expect.any(Function));
    expect(mapServiceMock.on).toHaveBeenCalledWith(MapSocketEvents.ToggleMapVisibility, expect.any(Function));
  });

  it('forwards mapDeleted to mapManagementRoom', () => {
    expect(mapDeletedHandler).toBeDefined();
    mapDeletedHandler?.('id-123');
    expect(server.to).toHaveBeenCalledWith(PageRoom.MapManagementRoom);
    expect(server.emit).toHaveBeenCalledWith(MapSocketEvents.MapDeleted, 'id-123');
  });

  it('forwards mapCreated to mapManagementRoom', () => {
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
    const expectedSummary: MapSummary = {
      id: 'map-1',
      name: 'Created map',
      description: 'desc',
      mode: GameMode.CLASSIC,
      size: MapSize.S,
      date: '2026-02-12T00:00:00.000Z',
      visibility: true,
      previewImage: undefined,
      previewImageFormat: undefined,
    };
    expect(mapCreatedHandler).toBeDefined();
    mapCreatedHandler?.(createdMap);

    expect(server.to).toHaveBeenCalledWith(PageRoom.MapManagementRoom);
    expect(server.emit).toHaveBeenCalledWith(MapSocketEvents.MapCreated, expectedSummary);
  });

  it('forward ToggleMapVisibility to MapManagement', () => {
    const payload = {
      id: 'mapId',
      isVisible: false,
    };
    expect(mapVisibilityHandler).toBeDefined();
    mapVisibilityHandler?.(payload);
    expect(server.to).toHaveBeenCalledWith(PageRoom.MapManagementRoom);
    expect(server.emit).toHaveBeenCalledWith(MapSocketEvents.ToggleMapVisibility, payload);
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
    const expectedSummary: MapSummary = {
      id: 'map-1',
      name: 'Created map',
      description: 'desc',
      mode: GameMode.CLASSIC,
      size: MapSize.S,
      date: '2026-02-12T00:00:00.000Z',
      visibility: true,
      previewImage: undefined,
      previewImageFormat: undefined,
    };
    expect(mapEditHandler).toBeDefined();
    mapEditHandler?.(updatedMap);

    expect(server.to).toHaveBeenCalledWith(PageRoom.MapManagementRoom);
    expect(server.emit).toHaveBeenCalledWith(MapSocketEvents.MapUpdated, expectedSummary);
  });

  it('should unsubscribe to all handlers if the gateway is destroyed', () => {
    gateway.onModuleDestroy();

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      MapSocketEvents.MapDeleted,
      expect.any(Function),
    );

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      MapSocketEvents.MapCreated,
      expect.any(Function),
    );

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      MapSocketEvents.ToggleMapVisibility,
      expect.any(Function),
    );

    expect(mapServiceMock.off).toHaveBeenCalledWith(
      MapSocketEvents.MapUpdated,
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
