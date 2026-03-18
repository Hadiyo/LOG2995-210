import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSessionService } from './game-session.service';
import { createInternalPlayer, createMockSessionPlayers, mockGameSession1, mockGameSession2, mockWaitingRoom1 } from './game-session.service.mocks';

/**
 * GameSessionService Unit Tests
 *
 * Testing Strategy:
 * - Verify core session management functionality: retrieving sessions, waiting rooms, and player data.
 * - Include edge cases such as:
 *    • Nonexistent session or preview IDs to ensure methods handle missing data gracefully.
 *    • Sessions that have already started to prevent joining or fetching players incorrectly.
 *    • Players not in any session to ensure queries return empty/undefined results.
 * - These cases are tested to guarantee robustness and proper handling of invalid or unexpected inputs,
 *   which is crucial for maintaining correct game state and avoiding runtime errors during live gameplay.
 *
 * Mocks (PlayerService, GameMapService, Logger) isolate the service from external dependencies.
 */

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
    (service as unknown as { logger: Partial<Logger> }).logger = mockLogger;

    service.gameSessions.clear();
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

    describe('findSessionByPreview', () => {
        it('should return undefined when no sessions exist', () => {
            const result = service.findSessionByPreview('preview-1');
            expect(result).toBeUndefined();
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

    describe('getPlayersFromGameSession', () => {
        it('should return an empty array if no session matches the preview', () => {
            const result = service['getPlayersFromGameSession']('nonexistent-preview');
            expect(result).toEqual([]);
        });

        it('should return players information if session exists', () => {
            const gameSession = mockGameSession1();
            service['gameSessions'].set(gameSession.id, gameSession);
            const player1 = createInternalPlayer('socket1234', { id: 'player1Id' });
            const player2 = createInternalPlayer('socket4321', { id: 'player2Id' });

            jest.spyOn(mockPlayerService, 'getPlayerById')
            .mockReturnValueOnce(player1)
            .mockReturnValueOnce(player2);

            const result = service['getPlayersFromGameSession'](gameSession.id);

            expect(result.map(player => player.name)).toEqual(
                expect.arrayContaining([player1.player.information.name, player2.player.information.name]));
        });
    });
});