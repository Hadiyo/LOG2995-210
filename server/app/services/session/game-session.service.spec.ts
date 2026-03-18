import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import {
    createInternalPlayer,
    createMockPlayer,
    createMockSessionPlayers,
    mockGameSession1,
    mockGameSessionPreview1,
    mockWaitingRoom1,
} from '@app/services/session/game-session.service.mocks';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSessionService } from './game-session.service';

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
            const player1 = createInternalPlayer('socket1234', { id: 'playerId1' });
            const player2 = createInternalPlayer('socket4321', { id: 'playerId2' });

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
        it('should create a valid game session if mapPreview session and newPlayer is valid', async () => {
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
            void result;
        });

        it('should throw if saveGameMap fails', async () => {
            const player = createMockPlayer();
            jest.spyOn(mockGameMapService, 'saveGameMap').mockRejectedValue(new Error('Boom'));
            jest.spyOn(mockPlayerService, 'savePlayer').mockReturnValue(player);
            const payload = {
                id: 'randomId',
                character: player.information,
            };
            await expect(
            service.createGameSession(payload, 'socket1234'),
            ).rejects.toThrow('Boom');
        });

        it('should throw if savePlayer fails', async () => {
            const preview = mockGameSessionPreview1();
            const player = createMockPlayer();
            jest.spyOn(mockGameMapService, 'saveGameMap').mockResolvedValue(preview);
            jest.spyOn(mockPlayerService, 'savePlayer')
                .mockImplementation(() => {
                    throw new Error('Boom'); 
                });
            const payload = {
                id: preview.id,
                character: player.information,
            };
            await expect(
            service.createGameSession(payload, 'socket1234'),
            ).rejects.toThrow('Boom');
        });
    });
});