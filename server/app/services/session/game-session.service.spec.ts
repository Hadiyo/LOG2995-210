import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import {
    createInternalPlayer,
    createMockPlayer,
    createMockSessionPlayers,
    mockGameSession1,
    mockGameSession2,
    mockGameSessionPreview1,
    mockWaitingRoom1,
} from '@app/services/session/game-session.service.mocks';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { GameMap } from '@common/maps/map.interface';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSessionService } from './game-session.service';

function createMockGameMap(): GameMap {
    return {
        id: 'map1',
        name: 'Forest',
        mode: GameMode.CLASSIC,
        size: MapSize.M,
        map: [],
        objects: [],
    };
}

describe('GameSessionService', () => {
  let service: GameSessionService;
  let mockPlayerService: Partial<PlayerService>;
  let mockGameMapService: Partial<GameMapService>;
  let mockLogger: Partial<Logger>;

  beforeEach(async () => {
    mockLogger = {
        error: jest.fn(),
    };
    mockPlayerService = {
      getPlayerById: jest.fn(),
      getPlayerBySocketId: jest.fn().mockReturnValue(undefined),
      createRuntimePlayers: jest.fn(),
      removePlayer: jest.fn(),
      savePlayer: jest.fn(),
    };

    mockGameMapService = {
        getGameMapById: jest.fn(),
        getPreviewById: jest.fn(),
        updatePreviewLockState: jest.fn(),
        deleteGameMap: jest.fn(),
        deleteGameMapPreview: jest.fn(),
        updateNumberOfPlayers: jest.fn(),
        saveGameMap: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameSessionService,
        {
            provide: PlayerService,
            useValue: mockPlayerService,
        },
        {
            provide: GameMapService,
            useValue: mockGameMapService,
        },
        {
            provide: Logger,
            useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<GameSessionService>(GameSessionService);
    // Logger is created in constructor, not injected — replace after creation
    (service as unknown as { logger: Partial<Logger> }).logger = mockLogger;
  });

  describe('getGameSessionById', () => {
        it('should return undefined if session does not exist', () => {
            expect(service.getGameSessionById('nonexistent')).toBeUndefined();
        });

        it('should return the session if it exists', () => {
            const mockSession = mockGameSession1();
            service['gameSessions'].set('session1', mockSession);
            expect(service.getGameSessionById('session1')).toEqual(mockSession);
        });
    });

    describe('getWaitingRoomState', () => {
        it('should return undefined if session does not exist', () => {
            expect(service.getWaitingRoomState('nonexistent')).toBeUndefined();
        });

        it('should return the waiting room state if session exists', () => {
            const mockSession = mockGameSession1();
            const mockWaitingRoom = mockWaitingRoom1();
            const mockPlayers = createMockSessionPlayers();
            service['gameSessions'].set('session1', mockSession);
            // Spy on private method
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(service as any, 'getPlayersFromGameSession').mockReturnValue(mockPlayers);
            const result = service.getWaitingRoomState('session1');
            expect(result).toEqual(mockWaitingRoom);
        });
    });

    describe('getPlayersFromGamePreview', () => {
        it('should return an empty array if no session matches the preview', () => {
            jest.spyOn(service, 'findSessionByPreview').mockReturnValue(undefined);
            const result = service.getPlayersFromGamePreview('nonexistent-preview');
            expect(result).toEqual([]);
        });

        it('should return players information if session exists', () => {
            const session = mockGameSession1();
            const player1 = createInternalPlayer('socket1234', { id: 'player1Id' });
            const player2 = createInternalPlayer('socket4321', { id: 'player2Id' });

            jest.spyOn(service, 'findSessionByPreview').mockReturnValue(session);

            jest.spyOn(mockPlayerService, 'getPlayerById')
            .mockReturnValueOnce(player1)
            .mockReturnValueOnce(player2);

            const result = service.getPlayersFromGamePreview('map1');

            expect(result.map(player => player.name)).toEqual(
                expect.arrayContaining([player1.player.information.name, player2.player.information.name]));
        });
    });

    describe('createGameSession', () => {
        it('should create a valid game session and return PlayerPayload on success', async () => {
            const preview = mockGameSessionPreview1();
            const player = createMockPlayer();
            const payload = {
                id: preview.id,
                character: player.information,
            };
            const waitingRoom = mockWaitingRoom1();
            jest.spyOn(mockGameMapService, 'saveGameMap').mockResolvedValue(preview);
            jest.spyOn(mockPlayerService, 'savePlayer').mockReturnValue(player);
            // to mock private service method
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(service as any, 'generateWaitingRoomPayload').mockReturnValue(waitingRoom);

            const result = await service.createGameSession(payload, 'socket1234');
            const sessions = Array.from(service['gameSessions'].values());
            expect(sessions.length).toBe(1);

            const createdSession = sessions[0];
            expect(createdSession).toMatchObject({
                players: [player.id],
                mapTemplateId: preview.id,
                debugMode: false,
                isLocked: preview.nbOfPlayers >= preview.maxPlayers,
                maxPlayers: preview.maxPlayers,
                hasStarted: false,
                messages: [],
            });
            expect(service['generateWaitingRoomPayload']).toHaveBeenCalledWith(
                sessions[0],
                [player.information],
                player.information,
                preview,
            );
            expect(result).toEqual({ waitingRoom, mapPreview: preview });
        });

        it('should return undefined and log error when saveGameMap fails', async () => {
            const player = createMockPlayer();
            jest.spyOn(mockGameMapService, 'saveGameMap').mockRejectedValue(new Error('DB fail'));
            jest.spyOn(mockPlayerService, 'savePlayer').mockReturnValue(player);
            const payload = { id: 'randomId', character: player.information };

            const result = await service.createGameSession(payload, 'socket1234');

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should return undefined and log error when savePlayer fails', async () => {
            const preview = mockGameSessionPreview1();
            const player = createMockPlayer();
            jest.spyOn(mockGameMapService, 'saveGameMap').mockResolvedValue(preview);
            jest.spyOn(mockPlayerService, 'savePlayer').mockImplementation(() => {
                throw new Error('Player save error');
            });
            const payload = { id: preview.id, character: player.information };

            const result = await service.createGameSession(payload, 'socket1234');

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should call cleanupExistingPlayerForSocket when a player already uses that socketId', async () => {
            const preview = mockGameSessionPreview1();
            const existingPlayer = createInternalPlayer('socket1234');
            const newPlayer = createMockPlayer();
            const waitingRoom = mockWaitingRoom1();

            jest.spyOn(mockPlayerService, 'getPlayerBySocketId').mockReturnValue(existingPlayer);
            jest.spyOn(mockGameMapService, 'saveGameMap').mockResolvedValue(preview);
            jest.spyOn(mockPlayerService, 'savePlayer').mockReturnValue(newPlayer);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(service as any, 'generateWaitingRoomPayload').mockReturnValue(waitingRoom);

            await service.createGameSession({ id: preview.id, character: newPlayer.information }, 'socket1234');

            expect(mockPlayerService.getPlayerBySocketId).toHaveBeenCalledWith('socket1234');
        });
    });

    describe('joinGameSession', () => {
        it('should return undefined when no session matches the previewId', () => {
            jest.spyOn(service, 'findSessionByPreview').mockReturnValue(undefined);

            const result = service.joinGameSession({ id: 'bad-id', character: createMockPlayer().information }, 'socket-1');

            expect(result).toBeUndefined();
        });

        it('should add player to session and return WaitingRoom on success', () => {
            const session = mockGameSession1();
            const player = createMockPlayer();
            const preview = mockGameSessionPreview1();
            const waitingRoom = mockWaitingRoom1();

            service['gameSessions'].set(session.id, session);
            jest.spyOn(service, 'findSessionByPreview').mockReturnValue(session);
            jest.spyOn(mockPlayerService, 'savePlayer').mockReturnValue(player);
            jest.spyOn(mockGameMapService, 'getPreviewById').mockReturnValue(preview);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(service as any, 'getPlayersFromGameSession').mockReturnValue(createMockSessionPlayers());
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.spyOn(service as any, 'generateWaitingRoomPayload').mockReturnValue(waitingRoom);

            const result = service.joinGameSession({ id: preview.id, character: player.information }, 'socket-1');

            expect(session.players).toContain(player.id);
            expect(mockGameMapService.updateNumberOfPlayers).toHaveBeenCalledWith(preview.id, 1);
            expect(result).toEqual(waitingRoom);
        });

        it('should return undefined and log error when an exception is thrown', () => {
            jest.spyOn(service, 'findSessionByPreview').mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = service.joinGameSession({ id: 'x', character: createMockPlayer().information }, 'socket-1');

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('leaveGameSession', () => {
        it('should return undefined when player is not in any session', () => {
            expect(service.leaveGameSession('ghost-player')).toBeUndefined();
        });

        it('should return undefined when sessionId is found but session does not exist in the map', () => {
            jest.spyOn(service, 'findPlayerInGameSession').mockReturnValue('missing-session-id');

            expect(service.leaveGameSession('player-1')).toBeUndefined();
        });

        it('should remove player, update map count and return sessionId', () => {
            const session = mockGameSession1(); // players: ['player1Id', 'player2Id']
            service['gameSessions'].set(session.id, session);

            const result = service.leaveGameSession('player1Id');

            expect(session.players).not.toContain('player1Id');
            expect(mockPlayerService.removePlayer).toHaveBeenCalledWith('player1Id');
            expect(mockGameMapService.updateNumberOfPlayers).toHaveBeenCalledWith(session.mapTemplateId, -1);
            expect(result).toBe(session.id);
        });

        it('should delete the session when the last player leaves', () => {
            const session = mockGameSession1();
            session.players = ['only-player'];
            service['gameSessions'].set(session.id, session);

            service.leaveGameSession('only-player');

            expect(service['gameSessions'].has(session.id)).toBe(false);
        });

        it('should return undefined and log error when an exception is thrown', () => {
            jest.spyOn(service, 'findPlayerInGameSession').mockImplementation(() => {
                throw new Error('Boom');
            });

            const result = service.leaveGameSession('player-1');

            expect(result).toBeUndefined();
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('canStartGame', () => {
        it('should return false when session does not exist', () => {
            expect(service.canStartGame('nonexistent')).toBe(false);
        });

        it('should return true when session exists and has not started', () => {
            const session = mockGameSession1(); // hasStarted: false
            service['gameSessions'].set(session.id, session);
            expect(service.canStartGame(session.id)).toBe(true);
        });

        it('should return false when session has already started', () => {
            const session = mockGameSession2(); // hasStarted: true
            service['gameSessions'].set(session.id, session);
            expect(service.canStartGame(session.id)).toBe(false);
        });
    });

    describe('startGameSession', () => {
        it('should return undefined when session does not exist', () => {
            expect(service.startGameSession('nonexistent')).toBeUndefined();
        });

        it('should return undefined when session has already started', () => {
            const session = mockGameSession2(); // hasStarted: true
            service['gameSessions'].set(session.id, session);
            expect(service.startGameSession(session.id)).toBeUndefined();
        });

        it('should return undefined when the game map is not found', () => {
            const session = mockGameSession1();
            service['gameSessions'].set(session.id, session);
            jest.spyOn(mockGameMapService, 'getGameMapById').mockReturnValue(undefined);

            expect(service.startGameSession(session.id)).toBeUndefined();
        });

        it('should return GameStartedPayload and mark session as started on success', () => {
            const session = mockGameSession1();
            service['gameSessions'].set(session.id, session);

            const mockGameMap = createMockGameMap();
            const mockPlayers = [createMockPlayer()];
            jest.spyOn(mockGameMapService, 'getGameMapById').mockReturnValue(mockGameMap);
            jest.spyOn(mockPlayerService, 'createRuntimePlayers').mockReturnValue(mockPlayers);

            const result = service.startGameSession(session.id);

            expect(result).toBeDefined();
            expect(result?.snapshot.id).toBe(session.id);
            expect(session.hasStarted).toBe(true);
        });
    });

    describe('deleteGameSession', () => {
        it('should do nothing when no session matches the preview', () => {
            service.deleteGameSession('nonexistent-preview');
            expect(mockPlayerService.removePlayer).not.toHaveBeenCalled();
        });

        it('should remove all players and delete the session', () => {
            const session = mockGameSession1(); // players: ['player1Id', 'player2Id']
            service['gameSessions'].set(session.id, session);

            service.deleteGameSession(session.mapTemplateId);

            expect(mockPlayerService.removePlayer).toHaveBeenCalledWith('player1Id');
            expect(mockPlayerService.removePlayer).toHaveBeenCalledWith('player2Id');
            expect(service['gameSessions'].has(session.id)).toBe(false);
        });
    });

    describe('findSessionByPreview', () => {
        it('should return undefined when no sessions exist', () => {
            expect(service.findSessionByPreview('preview-1')).toBeUndefined();
        });

        it('should return the session matching the previewId that has not started', () => {
            const session = mockGameSession1(); // mapTemplateId: 'map1', hasStarted: false
            service['gameSessions'].set(session.id, session);
            expect(service.findSessionByPreview('map1')).toEqual(session);
        });

        it('should return undefined when the matching session has already started', () => {
            const session = mockGameSession2(); // mapTemplateId: 'map2', hasStarted: true
            service['gameSessions'].set(session.id, session);
            expect(service.findSessionByPreview('map2')).toBeUndefined();
        });
    });

    describe('findPlayerInGameSession', () => {
        it('should return undefined when no sessions exist', () => {
            expect(service.findPlayerInGameSession('player-1')).toBeUndefined();
        });

        it('should return the sessionId when the player is in a session', () => {
            const session = mockGameSession1(); // players: ['player1Id', 'player2Id']
            service['gameSessions'].set(session.id, session);
            expect(service.findPlayerInGameSession('player1Id')).toBe(session.id);
        });

        it('should return undefined when the player is not in any session', () => {
            const session = mockGameSession1();
            service['gameSessions'].set(session.id, session);
            expect(service.findPlayerInGameSession('ghost-player')).toBeUndefined();
        });
    });
});
