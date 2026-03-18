import { PageRoom } from '@app/gateways/rooms.record';
import { SessionGateway } from '@app/gateways/session/session.gateway';
import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionService } from '@app/services/session/game-session.service';
import {
    GameSessionPreview,
    JoinSessionPayload,
    PlayerPayload,
    WaitingRoom,
} from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { PlayerInformation } from '@common/player/player.interface';
import { ErrorSocketEvents, RoomSocketEvents, WaitingRoomEvents } from '@common/socket-events';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';

const MOCK_MAX_PLAYERS = 4;

const mockPlayerInfo: PlayerInformation = {
    name: 'TestPlayer',
    avatarId: 0,
    isOrganizer: false,
    dices: { attack: 'D4', defense: 'D6' },
    bonus: 'speed',
};

const mockPreview: GameSessionPreview = {
    id: 'preview-1',
    name: 'Test Game',
    description: 'desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 1,
    maxPlayers: MOCK_MAX_PLAYERS,
    isLocked: false,
};

const mockWaitingRoom: WaitingRoom = {
    sessionId: 'session-1',
    mapPreviewId: 'preview-1',
    players: [mockPlayerInfo],
    clientPlayer: mockPlayerInfo,
    messages: [],
    isLocked: false,
    maxPlayers: MOCK_MAX_PLAYERS,
};

const mockPlayerPayload: PlayerPayload = {
    waitingRoom: mockWaitingRoom,
    mapPreview: mockPreview,
};

const mockJoinPayload: JoinSessionPayload = {
    id: 'preview-1',
    character: mockPlayerInfo,
};

describe('SessionGateway', () => {
    let gateway: SessionGateway;
    let sessionServiceMock: jest.Mocked<Partial<GameSessionService>>;
    let serverEmit: jest.Mock;
    let serverTo: jest.Mock;
    let server: Server;

    function createMockSocket(id: string, extraRooms: string[] = []): Socket & { _toEmit: jest.Mock } {
        const socketRooms = new Set<string>([id, ...extraRooms]);
        const toEmit = jest.fn();
        const to = jest.fn().mockReturnValue({ emit: toEmit });
        return {
            id,
            rooms: socketRooms,
            join: jest.fn((room: string) => socketRooms.add(room)),
            leave: jest.fn((room: string) => socketRooms.delete(room)),
            emit: jest.fn(),
            to,
            _toEmit: toEmit,
        } as unknown as Socket & { _toEmit: jest.Mock };
    }

    beforeEach(async () => {
        serverEmit = jest.fn();
        serverTo = jest.fn().mockReturnValue({ emit: serverEmit });
        server = { to: serverTo } as unknown as Server;

        sessionServiceMock = {
            createGameSession: jest.fn(),
            findSessionByPreview: jest.fn(),
            getPlayersFromGamePreview: jest.fn(),
            joinGameSession: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SessionGateway,
                { provide: GameSessionService, useValue: sessionServiceMock },
                { provide: ChatService, useValue: {} },
            ],
        }).compile();

        gateway = module.get<SessionGateway>(SessionGateway);
        (gateway as unknown as { server: Server }).server = server;
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    describe('createGameSession', () => {

        it('should join room and emit events when session is created successfully', async () => {
            const client = createMockSocket('socket-1');
            (sessionServiceMock.createGameSession as jest.Mock).mockResolvedValue(mockPlayerPayload);

            await gateway.createGameSession(mockJoinPayload, client);

            expect(sessionServiceMock.createGameSession).toHaveBeenCalledWith(mockJoinPayload, 'socket-1');
            expect(client.join as jest.Mock).toHaveBeenCalledWith('session-1');
            expect(serverTo).toHaveBeenCalledWith(PageRoom.JoinSessionsRoom);
            expect(serverEmit).toHaveBeenCalledWith(RoomSocketEvents.NewAvailableSession, mockPreview);
            expect(client.emit as jest.Mock).toHaveBeenCalledWith(RoomSocketEvents.PlayerJoinedGame);
            expect(client.emit as jest.Mock).toHaveBeenCalledWith(WaitingRoomEvents.ClientJoinedSession, mockWaitingRoom);
        });

        it('should log error and return early when service returns undefined', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gatewayLogger = (gateway as any).logger;
            jest.spyOn(gatewayLogger, 'error').mockImplementation(jest.fn());
            const client = createMockSocket('socket-1');
            (sessionServiceMock.createGameSession as jest.Mock).mockResolvedValue(undefined);

            await gateway.createGameSession(mockJoinPayload, client);

            expect(client.join as jest.Mock).not.toHaveBeenCalled();
            expect(client.emit as jest.Mock).not.toHaveBeenCalled();
            expect(gatewayLogger.error).toHaveBeenCalled();
        });

        it('should log error and stop when client fails to join the socket room', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gatewayLogger = (gateway as any).logger;
            jest.spyOn(gatewayLogger, 'error').mockImplementation(jest.fn());
            const client = createMockSocket('socket-1');
            // Override join to not actually add to rooms so has() stays false
            (client.join as jest.Mock).mockImplementation(() => { /* intentionally empty */ });
            (sessionServiceMock.createGameSession as jest.Mock).mockResolvedValue(mockPlayerPayload);

            await gateway.createGameSession(mockJoinPayload, client);

            expect(serverTo).not.toHaveBeenCalled();
            expect(client.emit as jest.Mock).not.toHaveBeenCalled();
            expect(gatewayLogger.error).toHaveBeenCalled();
        });

        it('should emit ServerError to client when service throws', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gatewayLogger = (gateway as any).logger;
            jest.spyOn(gatewayLogger, 'error').mockImplementation(jest.fn());
            const client = createMockSocket('socket-1');
            (sessionServiceMock.createGameSession as jest.Mock)
                .mockRejectedValue(new Error('DB failure'));

            await expect(
                gateway.createGameSession(mockJoinPayload, client),
            ).resolves.toBeUndefined();

            expect(client.emit as jest.Mock).toHaveBeenCalledWith(
                ErrorSocketEvents.ServerError,
            );
            expect(gatewayLogger.error).toHaveBeenCalled();
        });

        it('should leave previous game rooms before joining the new session room', async () => {
            const previousGameRoom = 'old-game-room';
            const client = createMockSocket('socket-1', [previousGameRoom, PageRoom.JoinSessionsRoom]);
            (sessionServiceMock.createGameSession as jest.Mock).mockResolvedValue(mockPlayerPayload);

            await gateway.createGameSession(mockJoinPayload, client);

            expect(client.leave as jest.Mock).toHaveBeenCalledWith(previousGameRoom);
            expect(client.leave as jest.Mock).not.toHaveBeenCalledWith('socket-1');
            expect(client.leave as jest.Mock).not.toHaveBeenCalledWith(PageRoom.JoinSessionsRoom);
        });
    });

    describe('joinGameSession', () => {
        it('should join session room and emit InitPlayers when session is found', () => {
            const client = createMockSocket('socket-1');
            const mockSession = { id: 'room-1', mapTemplateId: 'preview-1' };
            (sessionServiceMock.findSessionByPreview as jest.Mock).mockReturnValue(mockSession);
            (sessionServiceMock.getPlayersFromGamePreview as jest.Mock).mockReturnValue([mockPlayerInfo]);

            gateway.joinGameSession('preview-1', client);

            expect(client.join as jest.Mock).toHaveBeenCalledWith('room-1');
            expect(client.emit as jest.Mock).toHaveBeenCalledWith(WaitingRoomEvents.InitPlayers, [mockPlayerInfo]);
        });

        it('should do nothing when session is not found', () => {
            const client = createMockSocket('socket-1');
            (sessionServiceMock.findSessionByPreview as jest.Mock).mockReturnValue(undefined);

            gateway.joinGameSession('preview-1', client);

            expect(client.join as jest.Mock).not.toHaveBeenCalled();
            expect(client.emit as jest.Mock).not.toHaveBeenCalled();
        });
    });

    describe('addPlayerToSession', () => {
        it('should join room and emit all events when waitingRoom is returned', () => {
            const client = createMockSocket('socket-1');
            (sessionServiceMock.joinGameSession as jest.Mock).mockReturnValue(mockWaitingRoom);

            gateway.addPlayerToSession(mockJoinPayload, client);

            expect(client.join as jest.Mock).toHaveBeenCalledWith('session-1');
            expect(client.emit as jest.Mock).toHaveBeenCalledWith(RoomSocketEvents.PlayerJoinedGame);
            expect(client.emit as jest.Mock).toHaveBeenCalledWith(WaitingRoomEvents.ClientJoinedSession, mockWaitingRoom);
            expect(client.to as jest.Mock).toHaveBeenCalledWith('session-1');
            expect(client._toEmit).toHaveBeenCalledWith(WaitingRoomEvents.PlayerJoinedSession, mockPlayerInfo);
            expect(serverTo).toHaveBeenCalledWith('session-1');
            expect(serverEmit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomState, mockWaitingRoom);
            expect(serverTo).toHaveBeenCalledWith(PageRoom.JoinSessionsRoom);
            expect(serverEmit).toHaveBeenCalledWith(RoomSocketEvents.IncrementPlayerCount, 'preview-1');
        });

        it('should do nothing when joinGameSession returns undefined', () => {
            const client = createMockSocket('socket-1');
            (sessionServiceMock.joinGameSession as jest.Mock).mockReturnValue(undefined);

            gateway.addPlayerToSession(mockJoinPayload, client);

            expect(client.join as jest.Mock).not.toHaveBeenCalled();
            expect(client.emit as jest.Mock).not.toHaveBeenCalled();
        });

        it('should leave previous game rooms before joining the new session room', () => {
            const previousRoom = 'old-room';
            const client = createMockSocket('socket-1', [previousRoom]);
            (sessionServiceMock.joinGameSession as jest.Mock).mockReturnValue(mockWaitingRoom);

            gateway.addPlayerToSession(mockJoinPayload, client);

            expect(client.leave as jest.Mock).toHaveBeenCalledWith(previousRoom);
            expect(client.leave as jest.Mock).not.toHaveBeenCalledWith('socket-1');
        });
    });

    describe('leaveSession', () => {
        it('should leave the session room when session is found and client is in it', () => {
            const client = createMockSocket('socket-1', ['game-room-1']);
            (sessionServiceMock.findSessionByPreview as jest.Mock).mockReturnValue({ id: 'game-room-1' });

            gateway.leaveSession('preview-1', client);

            expect(client.leave as jest.Mock).toHaveBeenCalledWith('game-room-1');
        });

        it('should do nothing when session is not found', () => {
            const client = createMockSocket('socket-1');
            (sessionServiceMock.findSessionByPreview as jest.Mock).mockReturnValue(undefined);

            gateway.leaveSession('preview-1', client);

            expect(client.leave as jest.Mock).not.toHaveBeenCalled();
        });

        it('should do nothing when client is not in the session room', () => {
            const client = createMockSocket('socket-1');
            (sessionServiceMock.findSessionByPreview as jest.Mock).mockReturnValue({ id: 'game-room-not-joined' });

            gateway.leaveSession('preview-1', client);

            expect(client.leave as jest.Mock).not.toHaveBeenCalled();
        });
    });
});
