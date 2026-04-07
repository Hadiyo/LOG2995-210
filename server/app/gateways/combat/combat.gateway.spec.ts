import { CombatService } from '@app/services/combat/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { Test, TestingModule } from '@nestjs/testing';
import { CombatGateway } from './combat.gateway';

describe('CombatGateway', () => {
  let gateway: CombatGateway;
  let combatServiceMock: Partial<CombatService>;
  let gameSessionServiceMock: Partial<GameSessionService>;

  beforeEach(async () => {

    combatServiceMock = {
      startCombat: jest.fn(),
      createCombatSession: jest.fn(),
      combatTurn: jest.fn(),
    };

    gameSessionServiceMock = {
      getPlayerIdForSocket: jest.fn(),
      getSocketFromPlayer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CombatGateway, 
        { provide: CombatService, useValue: combatServiceMock },
        { provide: GameSessionService, useValue: gameSessionServiceMock },
      ],
    }).compile();

    gateway = module.get<CombatGateway>(CombatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
