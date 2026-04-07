import { createMockSocket } from '@app/gateways/mocks';
import { MatchWaitingRoomGateway } from '@app/gateways/waiting-room/match-waiting-room.gateway';
import {
    CreateWaitingRoomPayload,
    getWaitingRoomRoom,
    WaitingRoomEvents,
} from '@common/socket-events';
import { Server } from 'socket.io';

const makeCreatePayload = (): CreateWaitingRoomPayload => ({
    mapId: 'map-1',
    player: {
        id: 'player-1',
        name: 'Alice',
        avatarId: 0,
        isOrganizer: false,
        speed: 4,
        maxHealth: 6,
        baseAttack: 4,
        baseDefense: 4,
        attackDie: 'D4',
        defenseDie: 'D6',
        controller: 'human',
    },
});

describe('MatchWaitingRoomGateway', () => {
    let gateway: MatchWaitingRoomGateway;
    let waitingRoomService: Record<string, jest.Mock>;
    let logger: { error: jest.Mock };
    let serverEmit: jest.Mock;
    let serverToEmit: jest.Mock;
    let serverInSocketsLeave: jest.Mock;
    let handlers: Record<string, ((payload: unknown) => void) | undefined>;

    beforeEach(() => {
        handlers = {};
        waitingRoomService = {
            on: jest.fn((event: string, handler: (payload: unknown) => void) => {
                handlers[event] = handler;
            }),
            off: jest.fn(),
            handleDisconnect: jest.fn(),
            getAccessCodeForSocket: jest.fn(),
            createWaitingRoom: jest.fn(),
            getWaitingRoomState: jest.fn(),
            joinWaitingRoom: jest.fn(),
            leaveWaitingRoom: jest.fn(),
            kickPlayer: jest.fn(),
            addMessage: jest.fn(),
            startGame: jest.fn(),
        };
        logger = { error: jest.fn() };
        serverEmit = jest.fn();
        serverToEmit = jest.fn();
        serverInSocketsLeave = jest.fn();
        const server = {
            emit: serverEmit,
            to: jest.fn().mockReturnValue({ emit: serverToEmit }),
            in: jest.fn().mockReturnValue({ socketsLeave: serverInSocketsLeave }),
        } as unknown as Server;

        gateway = new MatchWaitingRoomGateway(waitingRoomService as never, logger as never);
        (gateway as unknown as { server: Server }).server = server;

    });

    it('subscribes and unsubscribes waiting-room events', () => {
        expect(waitingRoomService.on).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomUpdated, expect.any(Function));
        expect(waitingRoomService.on).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomGameStarted, expect.any(Function));

        gateway.onModuleDestroy();

        expect(waitingRoomService.off).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomUpdated, expect.any(Function));
        expect(waitingRoomService.off).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomDirectoryUpdated, expect.any(Function));
    });

    it('forwards waiting-room service events to sockets', () => {
        handlers[WaitingRoomEvents.WaitingRoomUpdated]?.({
            accessCode: 'ABC123',
            payload: { accessCode: 'ABC123' },
        });
        handlers[WaitingRoomEvents.WaitingRoomMessageSent]?.({
            accessCode: 'ABC123',
            payload: { content: 'hello' },
        });
        handlers[WaitingRoomEvents.WaitingRoomError]?.({
            socketId: 'socket-1',
            payload: { message: 'bad' },
        });
        handlers[WaitingRoomEvents.WaitingRoomPlayerKicked]?.({
            accessCode: 'ABC123',
            kickedSocketId: 'socket-2',
        });
        handlers[WaitingRoomEvents.WaitingRoomCancelled]?.({ accessCode: 'ABC123' });
        handlers[WaitingRoomEvents.WaitingRoomGameStarted]?.({
            accessCode: 'ABC123',
            sessionId: 'session-1',
            messages: [],
        });
        handlers[WaitingRoomEvents.WaitingRoomDirectoryUpdated]?.({});

        expect(serverToEmit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomUpdated, { accessCode: 'ABC123' });
        expect(serverToEmit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomMessageSent, { content: 'hello' });
        expect(serverToEmit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomError, { message: 'bad' });
        expect(serverToEmit).toHaveBeenCalledWith(
            WaitingRoomEvents.WaitingRoomPlayerKicked,
            { message: "Vous avez été exclu de la salle d'attente par l'organisateur." },
        );
        expect(serverToEmit).toHaveBeenCalledWith(
            WaitingRoomEvents.WaitingRoomCancelled,
            { message: "La salle d'attente a été fermée." },
        );
        expect(serverToEmit).toHaveBeenCalledWith(
            WaitingRoomEvents.WaitingRoomGameStarted,
            { accessCode: 'ABC123', sessionId: 'session-1', messages: [] },
        );
        expect(serverInSocketsLeave).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(serverEmit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomDirectoryUpdated);
    });

    it('delegates disconnect handling', () => {
        gateway.handleDisconnect(createMockSocket('socket-1'));
        expect(waitingRoomService.handleDisconnect).toHaveBeenCalledWith('socket-1');
    });

    it('creates a waiting room, joins its socket room, and emits current state', async () => {
        const client = createMockSocket('socket-1');
        waitingRoomService.getAccessCodeForSocket.mockReturnValue('OLD999');
        waitingRoomService.createWaitingRoom.mockResolvedValue('ABC123');
        waitingRoomService.getWaitingRoomState.mockReturnValue({ accessCode: 'ABC123' });

        await gateway.createWaitingRoom(client, makeCreatePayload());

        expect(client.leave).toHaveBeenCalledWith(getWaitingRoomRoom('OLD999'));
        expect(waitingRoomService.createWaitingRoom).toHaveBeenCalledWith('socket-1', makeCreatePayload());
        expect(client.join).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(client.emit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomUpdated, { accessCode: 'ABC123' });
    });

    it('handles createWaitingRoom failures', async () => {
        const client = createMockSocket('socket-1');
        waitingRoomService.createWaitingRoom.mockRejectedValue(new Error('boom'));

        await gateway.createWaitingRoom(client, makeCreatePayload());

        expect(logger.error).toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(
            WaitingRoomEvents.WaitingRoomError,
            { message: "Impossible de créer la salle d'attente." },
        );
    });

    it('joins a waiting room only when the service accepts it', () => {
        const client = createMockSocket('socket-2');
        waitingRoomService.getAccessCodeForSocket.mockReturnValue('OLD999');
        waitingRoomService.joinWaitingRoom.mockReturnValue(true);
        waitingRoomService.getWaitingRoomState.mockReturnValue({ accessCode: 'ABC123', players: [] });

        gateway.joinWaitingRoom(client, {
            accessCode: 'ABC123',
            player: makeCreatePayload().player,
        });

        expect(client.leave).toHaveBeenCalledWith(getWaitingRoomRoom('OLD999'));
        expect(client.join).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(client.emit).toHaveBeenCalledWith(WaitingRoomEvents.WaitingRoomUpdated, { accessCode: 'ABC123', players: [] });

        (client.join as jest.Mock).mockClear();
        (client.emit as jest.Mock).mockClear();
        waitingRoomService.joinWaitingRoom.mockReturnValue(false);

        gateway.joinWaitingRoom(client, {
            accessCode: 'ABC123',
            player: makeCreatePayload().player,
        });

        expect(client.join).not.toHaveBeenCalled();
        expect(client.emit).not.toHaveBeenCalled();
    });

    it('delegates leave, kick, and send message operations', () => {
        const client = createMockSocket('socket-3');

        gateway.leaveWaitingRoom(client, { accessCode: 'ABC123' });
        gateway.kickPlayer(client, { accessCode: 'ABC123', playerId: 'player-2' });
        gateway.sendMessage(client, { accessCode: 'ABC123', content: 'hello' });

        expect(waitingRoomService.leaveWaitingRoom).toHaveBeenCalledWith('socket-3', 'ABC123');
        expect(client.leave).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(waitingRoomService.kickPlayer).toHaveBeenCalledWith('socket-3', { accessCode: 'ABC123', playerId: 'player-2' });
        expect(waitingRoomService.addMessage).toHaveBeenCalledWith('socket-3', { accessCode: 'ABC123', content: 'hello' });
    });

    it('starts a waiting room game and emits an error on failure', async () => {
        const client = createMockSocket('socket-4');

        await gateway.startGame(client, { accessCode: 'ABC123' });
        expect(waitingRoomService.startGame).toHaveBeenCalledWith('socket-4', 'ABC123');

        waitingRoomService.startGame.mockRejectedValue(new Error('boom'));
        await gateway.startGame(client, { accessCode: 'ABC123' });

        expect(logger.error).toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(
            WaitingRoomEvents.WaitingRoomError,
            { message: 'Impossible de lancer la partie.' },
        );
    });
});
