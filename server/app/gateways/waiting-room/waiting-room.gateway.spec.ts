import { Test, TestingModule } from '@nestjs/testing';
import { WaitingRoomGateway } from './waiting-room.gateway';

describe('WaitingRoomGateway', () => {
  let gateway: WaitingRoomGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WaitingRoomGateway],
    }).compile();

    gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
