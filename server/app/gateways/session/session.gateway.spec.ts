import { SocketRoom } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { SessionGateway } from './session.gateway';

describe('SessionGateway', () => {
  let gateway: SessionGateway;

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
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionGateway, { provide: Logger, useValue: loggerMock }],
    }).compile();

    gateway = module.get<SessionGateway>(SessionGateway);
  });

  it('should handle joinRoom', () => {
    const client = createMockSocket('socket1');
    gateway.joinMapSession(client);
    expect(loggerMock.log).toHaveBeenCalledWith(
      `Client socket1 joined ${SocketRoom.MapManagementRoom} successfully`,
    );
  });

  it('should handle leaveRoom', () => {
    const client = createMockSocket('socket1');
    client.rooms.add(SocketRoom.MapManagementRoom);
    gateway.leaveMapSession(client);
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

    gateway.joinMapSession(client);

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

    gateway.leaveMapSession(client);

    expect(client.leave).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket3 left ${SocketRoom.MapManagementRoom} successfully`,
    );
  });
});
