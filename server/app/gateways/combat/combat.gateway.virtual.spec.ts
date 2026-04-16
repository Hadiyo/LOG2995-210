import { CombatService } from '@app/services/combat/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeRuntime, makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import {
  createCombatTurnSnapshot,
  createGameSessionMock,
  createMockServer,
  createMockSocket,
  makeCombatSession,
} from '@app/utilities/mocks/mocks';
import { CombatTurnSnapshot } from '@common/combat/combat.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
import { CombatGateway } from './combat.gateway';

describe('CombatGateway virtual players', () => {
  let gateway: CombatGateway;
  let combatServiceMock: Partial<CombatService>;
  let gameSessionServiceMock: Partial<GameSessionService>;
  const server = createMockServer();

  beforeEach(async () => {
    jest.clearAllMocks();

    combatServiceMock = {
      startCombat: jest.fn(),
      createCombatSession: jest.fn(),
      combatTurn: jest.fn(),
      getCombatIdByRooms: jest.fn(),
      getCombatSession: jest.fn(),
    };

    gameSessionServiceMock = createGameSessionMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CombatGateway,
        { provide: CombatService, useValue: combatServiceMock },
        { provide: GameSessionService, useValue: gameSessionServiceMock },
      ],
    }).compile();

    gateway = module.get<CombatGateway>(CombatGateway);
    gateway['server'] = server as unknown as Server;
  });

  it('starts combat against a virtual defender without requiring an opponent socket', async () => {
    const socket = createMockSocket('1234');
    const baseRuntime = makeRuntime();
    const session = makeCombatSession();
    const game = makeRuntime({
      match: {
        ...baseRuntime.match,
        players: [
          { ...baseRuntime.match.players[0], id: '8906', controller: 'human', virtualProfile: null },
          { ...baseRuntime.match.players[1], id: '0000', controller: 'virtual', virtualProfile: 'aggressive' },
        ],
      },
    });
    const payload = { sessionId: '1555', playerId: '8906', defenderId: '0000' };
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    jest.spyOn(gameSessionServiceMock, 'getMatchFromSessionId').mockReturnValue(game.match);
    jest.spyOn(combatServiceMock, 'createCombatSession').mockReturnValue({ combat: session, game });
    const startCombatSpy = jest.spyOn(combatServiceMock, 'startCombat');

    await gateway.startCombat(socket, payload);

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith(session.id);
    expect(startCombatSpy).toHaveBeenCalledWith(session);
  });

  it('auto-submits an attack stance when the active combatant is an aggressive virtual player', () => {
    const baseRuntime = makeRuntime();
    const payload: CombatTurnSnapshot = createCombatTurnSnapshot({
      combatId: '6745',
      gameSessionId: 'game-1',
      turnState: makeTurnState({ activePlayerId: 'player-2', phase: 'active' }),
    });
    jest.spyOn(gameSessionServiceMock, 'getMatchFromSessionId').mockReturnValue({
      ...baseRuntime.match,
      players: [
        { ...baseRuntime.match.players[0], id: 'player-1', controller: 'human', virtualProfile: null },
        { ...baseRuntime.match.players[1], id: 'player-2', controller: 'virtual', virtualProfile: 'aggressive' },
      ],
    });

    gateway.handleTurnSwitch(payload);

    expect(combatServiceMock.combatTurn).toHaveBeenCalledWith(payload.combatId, 'player-2', 'attack');
  });

  it('auto-submits a defense stance when the active combatant is a defensive virtual player', () => {
    const baseRuntime = makeRuntime();
    const payload: CombatTurnSnapshot = createCombatTurnSnapshot({
      combatId: '6745',
      gameSessionId: 'game-1',
      turnState: makeTurnState({ activePlayerId: 'player-2', phase: 'active' }),
    });
    jest.spyOn(gameSessionServiceMock, 'getMatchFromSessionId').mockReturnValue({
      ...baseRuntime.match,
      players: [
        { ...baseRuntime.match.players[0], id: 'player-1', controller: 'human', virtualProfile: null },
        { ...baseRuntime.match.players[1], id: 'player-2', controller: 'virtual', virtualProfile: 'defensive' },
      ],
    });

    gateway.handleTurnSwitch(payload);

    expect(combatServiceMock.combatTurn).toHaveBeenCalledWith(payload.combatId, 'player-2', 'defense');
  });

  it('does not auto-submit a stance during a transition turn', () => {
    const payload: CombatTurnSnapshot = createCombatTurnSnapshot({
      combatId: '6745',
      gameSessionId: 'game-1',
      turnState: makeTurnState({ activePlayerId: 'player-2', phase: 'transition' }),
    });

    gateway.handleTurnSwitch(payload);

    expect(combatServiceMock.combatTurn).not.toHaveBeenCalled();
  });

  it('does not auto-submit a stance when no combatant is active', () => {
    const payload: CombatTurnSnapshot = createCombatTurnSnapshot({
      combatId: '6745',
      gameSessionId: 'game-1',
      turnState: makeTurnState({ activePlayerId: null, phase: 'active' }),
    });

    gateway.handleTurnSwitch(payload);

    expect(combatServiceMock.combatTurn).not.toHaveBeenCalled();
  });
});
