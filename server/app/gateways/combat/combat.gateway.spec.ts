import { createMockSocket } from '@app/gateways/page-room/page-room.gateway.spec';
import { makeCombatSession } from '@app/services/combat/combat-service.helper';
import { CombatService } from '@app/services/combat/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { SessionSocketEvents } from '@common/socket-events';
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

    expect(socket.emit).toHaveBeenCalledWith(SessionSocketEvents.GameSessionError, { message: 'Combat refusé.' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('should return and emit an error message if the opponents socket cannot be found - startCombat', () => {
    const socket = createMockSocket('1234');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(undefined);

    gateway.startCombat(socket, payload);

    expect(socket.emit).toHaveBeenCalledWith(SessionSocketEvents.GameSessionError, { message: 'Adversaire indisponible.' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('should return an emit an error message if the combat session was not successfully created - - startCombat', () => {
    const socket1 = createMockSocket('1234');
    const socket2 = createMockSocket('8975');
    const payload = {sessionId: '1555', playerId: '8906', defenderId: '0000'};
    jest.spyOn(gameSessionServiceMock, 'getPlayerIdForSocket').mockReturnValue('8906');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(gateway as any, 'getOpponentSocket').mockReturnValue(socket2);
    jest.spyOn(combatServiceMock, 'createCombatSession').mockReturnValue(undefined);

    gateway.startCombat(socket1, payload);

    expect(socket1.emit).toHaveBeenCalledWith(SessionSocketEvents.GameSessionError, { message: 'Combat impossible.' });
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
  
});
