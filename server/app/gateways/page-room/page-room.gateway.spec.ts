import { PageRoom } from '@app/gateways/rooms.record';
import { createMockLogger, createMockSocket } from '@app/utilities/mocks/mocks';
import { PageContext } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PageRoomGateway } from './page-room.gateway';

describe('PageRoomGateway', () => {
  let gateway: PageRoomGateway;
  const loggerMock = createMockLogger();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PageRoomGateway, { provide: Logger, useValue: loggerMock }],
    }).compile();

    gateway = module.get<PageRoomGateway>(PageRoomGateway);

    jest.clearAllMocks();
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
    const client = createMockSocket('1234');

    gateway.joinPage(client, payload);

    expect(client.join).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket2 joined ${PageRoom.MapManagementRoom} successfully`,
    );
  });

  it('leavePage should not log when room is still present after leave', () => {
    const room = PageRoom.MapManagementRoom;
    const payload = { page: PageContext.MapManagement };
    const client = createMockSocket('1234');
    client.join(room);

    gateway.leavePage(client, payload);

    expect(client.leave).toHaveBeenCalledWith(room);
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      `Client socket3 left ${PageRoom.MapManagementRoom} successfully`,
    );
  });
});
