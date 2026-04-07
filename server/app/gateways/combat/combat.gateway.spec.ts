import { createCombatResult, createMockCombatPlayerStatistics, createMockServer, createMockSocket } from '@app/gateways/mocks';
import { makeCombatSession } from '@app/services/combat/combat-service.helper';
import { CombatService } from '@app/services/combat/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import { CombatSessionSnapshot, CombatTurnSnapshot, StancePayload } from '@common/combat/combat.interface';
import { CombatSocketEvents, SessionSocketEvents } from '@common/socket-events';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';
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
    gateway['server'] = server as unknown as Server;
  });

  it('should disconnect the client if he is part of a combat session - handleDisconnect', () => {
    const socket = createMockSocket('1234');
    const roomId = 'room8976';
    socket.join(roomId);
    const spy = jest.spyOn(combatServiceMock, 'getCombatIdByRooms').mockReturnValue(roomId);

    gateway.handleDisconnect(socket);

    expect(spy).toHaveBeenCalled();
    expect(socket.rooms.has(roomId)).toBe(false);
    expect(socket.leave).toHaveBeenCalledWith(roomId);
  });

  it('should not disconnect the client if he is not part of a combat room - handleDisconnect', () => {
    const socket = createMockSocket('1234');
    const spy = jest.spyOn(combatServiceMock, 'getCombatIdByRooms').mockReturnValue(undefined);
    gateway.handleDisconnect(socket);
    expect(spy).toHaveBeenCalled();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it('should return and emit an error message if the client id is not part of a game session - startCombat', () => {
    const socket = createMockSocket('1234');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('hjsj');

    gateway.startCombat(socket, payload);

    expect(socket.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Combat refusé.' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('should return and emit an error message if the opponents socket cannot be found - startCombat', () => {
    const socket = createMockSocket('1234');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(undefined);

    gateway.startCombat(socket, payload);

    expect(socket.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Adversaire indisponible.' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('should return an emit an error message if the combat session was not successfully created - startCombat', () => {
    const socket1 = createMockSocket('1234');
    const socket2 = createMockSocket('8975');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket2);
    jest.spyOn(combatServiceMock, 'createCombatSession').mockReturnValue(undefined);

    gateway.startCombat(socket1, payload);

    expect(socket1.emit).toHaveBeenCalledWith(CombatSocketEvents.CombatSessionError, { message: 'Combat impossible.' });
    expect(socket1.join).not.toHaveBeenCalled();
  });

  it('should join the clients and the opponents socket to the combat session and start the game - startCombat', () => {
    const socket1 = createMockSocket('1234');
    const socket2 = createMockSocket('8975');
    const session = makeCombatSession();
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket2);
    jest.spyOn(combatServiceMock, 'createCombatSession').mockReturnValue(session);
    const spy = jest.spyOn(combatServiceMock, 'startCombat');

    gateway.startCombat(socket1, payload);

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
    const payload: CombatTurnSnapshot = { combatId: '6745', turnState: makeTurnState()};
    gateway.handleTurnSwitch(payload);
    expect(server.to).toHaveBeenCalledWith(payload.combatId);
    expect(server.emit).toHaveBeenCalledWith(CombatSocketEvents.TurnSnapshot, payload.turnState);
  });

  it('should not send the payload if the combatId is not valid but send an error message - handleTurnSwitch', () => {
    const payload: CombatTurnSnapshot = { combatId: undefined, turnState: makeTurnState()};
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
    expect(server.to).toHaveBeenNthCalledWith(2, payload.gameSessionId);
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
    expect(server.to).toHaveBeenNthCalledWith(2, payload.gameSessionId);
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

  it('should send the payload to the combat session but it should not remove the room if socket is undefined - handleOpponentDisconnect', () => {
    const payload = createCombatResult();
    const newPayload = { winner: payload.winner, loser: payload.loser };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(undefined);

    gateway.handleOpponentDisconnect(payload);

    expect(server.to).toHaveBeenCalledWith(payload.combatId);
    expect(server.emit).toHaveBeenCalledWith(CombatSocketEvents.Disconnect, newPayload);
    expect(spy).toHaveBeenCalled();
  });

  it('should send the payload and disconnect the opponents socket from the room - handleOpponentDisconnect', () => {
    const payload = createCombatResult();
    const socket = createMockSocket('0000');
    const newPayload = { winner: payload.winner, loser: payload.loser };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket);

    gateway.handleOpponentDisconnect(payload);

    expect(server.to).toHaveBeenCalledWith(payload.combatId);
    expect(server.emit).toHaveBeenCalledWith(CombatSocketEvents.Disconnect, newPayload);
    expect(spy).toHaveBeenCalled();
    expect(socket.leave).toHaveBeenCalledWith(payload.combatId);
  });

  it('should return undefined if the socket is not part of any game session - getOpponentSocket', () => {
    const gameSessionId = '9999';
    const opponentId = '8888';
    const spy = jest.spyOn(gameSessionServiceMock, 'getSocketFromPlayer').mockReturnValue(undefined);

    const result = gateway['getOpponentSocket'](gameSessionId, opponentId);

    expect(spy).toHaveBeenCalledWith(gameSessionId, opponentId);
    expect(result).toBeUndefined();
  });

  it('should return the opponent socket if it is part of a game session and is part of the current combat gateway server - getOpponentSocket', () => {
    const socketId = 'socket-123';
    const gameSessionId = '9999';
    const opponentId = '8888';
    const spy = jest.spyOn(gameSessionServiceMock, 'getSocketFromPlayer').mockReturnValue(socketId);

    const result = gateway['getOpponentSocket'](gameSessionId, opponentId);

    expect(spy).toHaveBeenCalledWith(gameSessionId, opponentId);
    expect(result).toEqual({
      id: socketId,
      rooms: expect.any(Set),
      join: expect.any(Function),
      leave: expect.any(Function),
      emit: expect.any(Function),
    });
  });
});
