import { Test, TestingModule } from '@nestjs/testing';
import { WaitingRoomGateway } from './waiting-room.gateway';
import { GameSessionService } from '@app/services/session/game-session.service';
import { PlayerService } from '@app/services/player/player.service';

describe('WaitingRoomGateway', () => {
  let gateway: WaitingRoomGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingRoomGateway,
        {
          provide: GameSessionService,
          useValue: {
            leaveGameSession: jest.fn(),
            deleteGameSession: jest.fn(),
            getGameSessionById: jest.fn(),
          },
        },
        {
          provide: PlayerService,
          useValue: {
            getPlayerBySocketId: jest.fn(),
            getPlayerByName: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
