import { CombatService } from '@app/services/combat/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeRuntime, makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import { MILLISECONDS_PER_SECOND } from '@app/utilities/combat/combat.constants';
import {
  createCombatResult,
  createCombatTurnSnapshot,
  createGameSessionMock,
  createMockCombatPlayerStatistics,
  createMockServer,
  createMockSocket,
  makeCombatSession,
} from '@app/utilities/mocks/mocks';
import { CombatSessionSnapshot, CombatTurnSnapshot, StancePayload } from '@common/combat/combat.interface';
import { CombatSocketEvents, getGameSessionRoom, SessionSocketEvents } from '@common/socket-events';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { CombatGateway } from './combat.gateway';

describe('CombatGateway', () => {
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
    };

    gameSessionServiceMock = createGameSessionMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CombatGateway, 
        { provide: CombatService, useValue: combatServiceMock },
        { provide: GameSessionService, useValue: gameSessionServiceMock },
      ],
    }).compile();

    gateway = module.get<CombatGateway>(CombatGateway);
    gateway['server'] = server as unknown as Server;
  });

  // it('should disconnect the client if he is part of a combat session - handleDisconnect', () => {
  //   const socket = createMockSocket('1234');
  //   const roomId = 'room8976';
  //   socket.join(roomId);
  //   const spy = jest.spyOn(combatServiceMock, 'getCombatIdByRooms').mockReturnValue(roomId);

  //   gateway.handleDisconnect(socket);

  //   expect(spy).toHaveBeenCalled();
  //   expect(socket.rooms.has(roomId)).toBe(false);
  //   expect(socket.leave).toHaveBeenCalledWith(roomId);
  // });

  // it('should not disconnect the client if he is not part of a combat room - handleDisconnect', () => {
  //   const socket = createMockSocket('1234');
  //   const spy = jest.spyOn(combatServiceMock, 'getCombatIdByRooms').mockReturnValue(undefined);
  //   gateway.handleDisconnect(socket);
  //   expect(spy).toHaveBeenCalled();
  //   expect(socket.leave).not.toHaveBeenCalled();
  // });

  it('should return and emit an error message if the client id is not part of a game session - startCombat', async () => {
    const socket = createMockSocket('1234');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('hjsj');

    await gateway.startCombat(socket, payload);

    expect(socket.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Combat refusé.' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('should return and emit an error message if the opponents socket cannot be found - startCombat', async () => {
    const socket = createMockSocket('1234');
    const socketsMap = new Map<string, Socket>([
      ['socket-123', socket],
    ]);
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(undefined);

    gateway['server'] = {
      sockets: socketsMap,
    } as unknown as Server;

    await gateway.startCombat(socket, payload);

    expect(socket.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Adversaire indisponible.' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('should return an emit an error message if the combat session was not successfully created - startCombat', async () => {
    const socket1 = createMockSocket('1234');
    const socket2 = createMockSocket('8975');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket2);
    jest.spyOn(combatServiceMock, 'createCombatSession').mockReturnValue(undefined);

    await gateway.startCombat(socket1, payload);

    expect(socket1.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Combat impossible.' });
    expect(socket1.join).not.toHaveBeenCalled();
  });

  it('should join the clients and the opponents socket to the combat session and start the game - startCombat', async () => {
    const socket1 = createMockSocket('1234');
    const socket2 = createMockSocket('8975');
    const session = makeCombatSession();
    const game = makeRuntime();
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket2);
    jest.spyOn(combatServiceMock, 'createCombatSession').mockReturnValue({ combat: session, game });
    const spy = jest.spyOn(combatServiceMock, 'startCombat');

    await gateway.startCombat(socket1, payload);

    expect(socket1.emit).not.toHaveBeenCalled();
    expect(socket1.join).toHaveBeenCalledWith(session.id);
    expect(socket2.join).toHaveBeenCalledWith(session.id);
    expect(spy).toHaveBeenCalledWith(session);
  });

  it('should emit an error message if combatTurn returns false - setCombatStance', () => {
    const socket = createMockSocket('4567');
    const payload: StancePayload = { combatId: '0000', playerId: '1111', stance: 'attack'};
    jest.spyOn(combatServiceMock, 'combatTurn').mockReturnValue(false);

    gateway.setCombatStance(socket, payload);

    expect(socket.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Joueur interdit.'});
  });

  it('should not return an error message if combatTurn returns true - setCombatStance', () => {
    const socket = createMockSocket('4567');
    const payload: StancePayload = { combatId: '0000', playerId: '1111', stance: 'attack'};
    jest.spyOn(combatServiceMock, 'combatTurn').mockReturnValue(true);

    gateway.setCombatStance(socket, payload);

    expect(socket.emit).not.toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Joueur interdit.'});
  });

  it('should send the payload if the combatId is valid - handleTurnSwitch', () => {
    const payload: CombatTurnSnapshot = {
      combatId: '6745',
      gameSessionId: 'game-1',
      attackerId: 'player-1',
      defenderId: 'player-2',
      round: 3,
      turnState: makeTurnState(),
    };
    gateway.handleTurnSwitch(payload);
    expect(server.to).toHaveBeenNthCalledWith(1, payload.combatId);
    expect(server.emit).toHaveBeenNthCalledWith(1, CombatSocketEvents.TurnSnapshot, payload.turnState);
    expect(server.to).toHaveBeenNthCalledWith(2, getGameSessionRoom(payload.gameSessionId));
    expect(server.emit).toHaveBeenNthCalledWith(2, SessionSocketEvents.CombatWaitingSnapshot, {
      combatId: payload.combatId,
      gameSessionId: payload.gameSessionId,
      attackerId: payload.attackerId,
      defenderId: payload.defenderId,
      activePlayerId: payload.turnState.activePlayerId,
      phase: payload.turnState.phase,
      round: payload.round,
      countdownSeconds: expect.any(Number),
    });
  });

  it('should not send the payload if the combatId is not valid but send an error message - handleTurnSwitch', () => {
    const payload: CombatTurnSnapshot = {
      combatId: undefined as unknown as string,
      gameSessionId: undefined as unknown as string,
      attackerId: 'player-1',
      defenderId: 'player-2',
      round: 1,
      turnState: makeTurnState(),
    };
    gateway.handleTurnSwitch(payload);
    expect(server.to).not.toHaveBeenCalledWith(undefined);
    expect(server.emit).not.toHaveBeenCalledWith(CombatSocketEvents.TurnSnapshot, payload.turnState);
  });

  it('should send the payload if the combatId is valid - handleCombatStatistics', () => {
    const statistics1 = createMockCombatPlayerStatistics();
    const statistics2 = createMockCombatPlayerStatistics();
    const payload: CombatSessionSnapshot = { combatId: '6745', statistics: [statistics1, statistics2]};
    gateway.handleCombatStatistics(payload);
    expect(server.to).toHaveBeenCalledWith(payload.combatId);
    expect(server.emit).toHaveBeenCalledWith(CombatSocketEvents.AttackSnapshot, payload.statistics);
  });

  it('should not send the payload if the combatId is not valid - handleCombatStatistics', () => {
    const statistics1 = createMockCombatPlayerStatistics();
    const statistics2 = createMockCombatPlayerStatistics();
    const payload: CombatSessionSnapshot = { combatId: undefined, statistics: [statistics1, statistics2]};
    gateway.handleCombatStatistics(payload);
    expect(server.to).not.toHaveBeenCalledWith(payload.combatId);
    expect(server.emit).not.toHaveBeenCalledWith(CombatSocketEvents.AttackSnapshot, payload.statistics);
  });

  it('should send the payload if both combatId and gameSessionId are valid - handleVictory', () => {
    const payload = createCombatResult();
    const newPayload = { winner: payload.winner, loser: payload.loser };
    gateway.handleVictory(payload);
    expect(server.to).toHaveBeenNthCalledWith(1, payload.combatId);
    expect(server.to).toHaveBeenNthCalledWith(2, getGameSessionRoom(payload.gameSessionId));
    expect(server.emit).toHaveBeenNthCalledWith(1, CombatSocketEvents.Victory, newPayload);
    expect(server.emit).toHaveBeenNthCalledWith(2, SessionSocketEvents.CombatVictory, newPayload);
  });

  it('should not send the payload if one of the sessionId is invalid - handleVictory', () => {
    const payload = createCombatResult({combatId: undefined });
    const newPayload = { winner: payload.winner, loser: payload.loser };
    gateway.handleVictory(payload);
    expect(server.to).not.toHaveBeenNthCalledWith(1, payload.combatId);
    expect(server.to).not.toHaveBeenNthCalledWith(2, payload.gameSessionId);
    expect(server.emit).not.toHaveBeenNthCalledWith(1, CombatSocketEvents.Victory, newPayload);
    expect(server.emit).not.toHaveBeenNthCalledWith(2, SessionSocketEvents.CombatVictory, newPayload);
  });

    it('should send the payload if both combatId and gameSessionId are valid - handleTie', () => {
    const payload = createCombatResult();
    const newPayload = { player1: payload.winner, player2: payload.loser };
    gateway.handleTie(payload);
    expect(server.to).toHaveBeenNthCalledWith(1, payload.combatId);
    expect(server.to).toHaveBeenNthCalledWith(2, getGameSessionRoom(payload.gameSessionId));
    expect(server.emit).toHaveBeenNthCalledWith(1, CombatSocketEvents.Tie, newPayload);
    expect(server.emit).toHaveBeenNthCalledWith(2, SessionSocketEvents.CombatTie, newPayload);
  });

  it('should not send the payload if one of the sessionId is invalid - handleTie', () => {
    const payload = createCombatResult({gameSessionId: undefined });
    const newPayload = { player1 : payload.winner, player2 : payload.loser };
    gateway.handleTie(payload);
    expect(server.to).not.toHaveBeenNthCalledWith(1, payload.combatId);
    expect(server.to).not.toHaveBeenNthCalledWith(2, payload.gameSessionId);
    expect(server.emit).not.toHaveBeenNthCalledWith(1, CombatSocketEvents.Tie, newPayload);
    expect(server.emit).not.toHaveBeenNthCalledWith(2, SessionSocketEvents.CombatTie, newPayload);
  });

  it('should not the the payload if combat id or game session id are undefined - handleOpponentDisconnect', () => {
    const payload = createCombatResult({combatId: undefined});
    const socket = createMockSocket('0000');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket);

    gateway.handleOpponentDisconnect(payload);

    expect(server.to).not.toHaveBeenCalled();
    expect(server.emit).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should send the payload and disconnect the opponents socket from the room - handleOpponentDisconnect', () => {
    const payload = createCombatResult();
    const newPayload = { winner: payload.winner, loser: payload.loser };

    gateway.handleOpponentDisconnect(payload);

    expect(server.to).toHaveBeenCalledWith(payload.combatId);
    expect(server.emit).toHaveBeenCalledWith(CombatSocketEvents.HandleDisconnect, newPayload);
    expect(server.in).toHaveBeenCalledWith(payload.combatId);
  });

  it('should return undefined if the socket is not part of any game session - getOpponentSocket', () => {
    const gameSessionId = '9999';
    const opponentId = '8888';
    const spy = jest.spyOn(gameSessionServiceMock, 'getSocketFromPlayer').mockReturnValue(undefined);

    const result = gateway['getOpponentSocket'](gameSessionId, opponentId);

    expect(spy).toHaveBeenCalledWith(gameSessionId, opponentId);
    expect(result).toBeUndefined();
  });

  it('should return the opponent socket if it exists in registry - getOpponentSocket', () => {
      const socketId = 'socket-123';
      const gameSessionId = '9999';
      const opponentId = '8888';

      const mockSocket = createMockSocket(socketId);

      jest.spyOn(gameSessionServiceMock, 'getSocketFromPlayer').mockReturnValue(socketId);

      gateway['server'] = {
        sockets: new Map([[socketId, mockSocket]]),
      } as unknown as Server;

      const result = gateway['getOpponentSocket'](gameSessionId, opponentId);

      expect(gameSessionServiceMock.getSocketFromPlayer).toHaveBeenCalledWith(
        gameSessionId,
        opponentId,
      );

      expect(result).toBe(mockSocket);
  });
  
  it('returns sockets when it is a Map - getSocketRegistry', () => {
    const mockServer = createMockServer({
      sockets: new Map(),
    });

    gateway['server'] = mockServer as unknown as Server;

    const result = gateway['getSocketRegistry']();

    expect(result).toBe(mockServer.sockets);
  });

  it('returns nested sockets map', () => {
    const mockMap = new Map<string, Socket>();

    const mockServer = createMockServer({
      sockets: {
        sockets: mockMap,
      },
    });

    gateway['server'] = mockServer as unknown as Server;

    const result = gateway['getSocketRegistry']();

    expect(result).toBe(mockMap);
  });

  it('returns empty Map fallback when sockets missing - getSocketRegistry', () => {
    const mockServer = createMockServer({
      sockets: undefined,
    });

    gateway['server'] = mockServer as unknown as Server;

    const result = gateway['getSocketRegistry']();

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('should return the activeTurnReaminingMs if turnState.phase is active - createWaitingSnapshot', () => {
    const REMAINING_TIME = 8;
    const payload = createCombatTurnSnapshot({turnState: makeTurnState({phase: 'active', activeTurnRemainingMs: REMAINING_TIME})});
    const result = gateway['createWaitingSnapshot'](payload);

    expect(result).toEqual({
      combatId: payload.combatId,
      gameSessionId: payload.gameSessionId,
      attackerId: payload.attackerId,
      defenderId: payload.defenderId,
      activePlayerId: payload.turnState.activePlayerId,
      phase: payload.turnState.phase,
      round: payload.round,
      countdownSeconds: Math.max(0, Math.ceil(REMAINING_TIME / MILLISECONDS_PER_SECOND)),
    });
  });

  it('should return transitionRemainingMs if the turnState.phase is transitive - createWaitingSnapshot', () => {
    const REMAINING_TIME = 10;
    const payload = createCombatTurnSnapshot({turnState: makeTurnState({phase: 'transition', transitionRemainingMs: REMAINING_TIME})});
    const result = gateway['createWaitingSnapshot'](payload);

    expect(result).toEqual({
      combatId: payload.combatId,
      gameSessionId: payload.gameSessionId,
      attackerId: payload.attackerId,
      defenderId: payload.defenderId,
      activePlayerId: payload.turnState.activePlayerId,
      phase: payload.turnState.phase,
      round: payload.round,
      countdownSeconds: Math.max(0, Math.ceil(REMAINING_TIME / MILLISECONDS_PER_SECOND)),
    });
  });

  it('should not use activeTurnRemainingMs if the phase is active - createWaitingSnapshot', () => {
    const REMAINING_TIME1 = 10;
    const REMAINING_TIME2 = 5;
    const payload = createCombatTurnSnapshot(
      {turnState: makeTurnState(
        {phase: 'transition', transitionRemainingMs: REMAINING_TIME1, activeTurnRemainingMs: REMAINING_TIME2},
      )},
    );
    
    const result = gateway['createWaitingSnapshot'](payload);

    expect(result).toEqual({
      combatId: payload.combatId,
      gameSessionId: payload.gameSessionId,
      attackerId: payload.attackerId,
      defenderId: payload.defenderId,
      activePlayerId: payload.turnState.activePlayerId,
      phase: payload.turnState.phase,
      round: payload.round,
      countdownSeconds: Math.max(0, Math.ceil(REMAINING_TIME1 / MILLISECONDS_PER_SECOND)),
    });
  });
});