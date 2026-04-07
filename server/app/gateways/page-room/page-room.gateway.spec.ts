import { PageRoom } from '@app/gateways/rooms.record';
import { PageContext } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { PageRoomGateway } from './page-room.gateway';

export function createMockSocket(id: string) {
    const rooms = new Set<string>();
    return {
      id,
      rooms,
      join: jest.fn((room: string) => rooms.add(room)),
      leave: jest.fn((room: string) => rooms.delete(room)),
      emit: jest.fn(),
    } as unknown as Socket;
  }

describe('PageRoomGateway', () => {
  let gateway: PageRoomGateway;

  const loggerMock = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageRoomGateway, { provide: Logger, useValue: loggerMock }],
    }).compile();

    gateway = module.get<PageRoomGateway>(PageRoomGateway);
  });


  it('should handle joinPage', () => {
    const client = createMockSocket('socket1');
    const payload = { page: PageContext.MapManagement };
    gateway.joinPage(client, payload);
    expect(loggerMock.log).toHaveBeenCalledWith(
      `Client socket1 joined ${PageRoom.MapManagementRoom} successfully`,
    );
  });

  it('should handle leavePage', () => {
    const client = createMockSocket('socket1');
    const payload = { page: PageContext.MapManagement };
    client.rooms.add(PageRoom.MapManagementRoom);
    gateway.leavePage(client, payload);
    expect(loggerMock.log).toHaveBeenCalledWith(
      `Client socket1 left ${PageRoom.MapManagementRoom} successfully`,
    );
  });

  it('joinPage should not log when room is still not present after join', () => {
    const room = PageRoom.MapManagementRoom;
    const payload = { page: PageContext.MapManagement };
    const client = {
      id: 'socket2',
      rooms: new Set<string>(), // stays empty
      join: jest.fn(), // does not add room
    } as unknown as Socket;

    gateway.joinPage(client, payload);

    expect(client.join).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket2 joined ${PageRoom.MapManagementRoom} successfully`,
    );
  });

  it('leavePage should not log when room is still present after leave', () => {
    const room = PageRoom.MapManagementRoom;
    const payload = { page: PageContext.MapManagement };
    const client = {
      id: 'socket3',
      rooms: new Set<string>([room]), // remains in room
      leave: jest.fn(), // does not remove room
    } as unknown as Socket;

    gateway.leavePage(client, payload);

    expect(client.leave).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket3 left ${PageRoom.MapManagementRoom} successfully`,
    );
  });
});
