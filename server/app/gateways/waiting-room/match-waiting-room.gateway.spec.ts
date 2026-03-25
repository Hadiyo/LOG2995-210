import { MatchWaitingRoomGateway } from '@app/gateways/waiting-room/match-waiting-room.gateway';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import {
    CreateWaitingRoomPayload,
    SocketEvents,
    getWaitingRoomRoom,
} from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

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

const makeSocket = (id: string): Socket => ({
    id,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
} as unknown as Socket);

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
        expect(waitingRoomService.on).toHaveBeenCalledWith(SocketEvents.WaitingRoomUpdated, expect.any(Function));
        expect(waitingRoomService.on).toHaveBeenCalledWith(SocketEvents.WaitingRoomGameStarted, expect.any(Function));

        gateway.onModuleDestroy();

        expect(waitingRoomService.off).toHaveBeenCalledWith(SocketEvents.WaitingRoomUpdated, expect.any(Function));
        expect(waitingRoomService.off).toHaveBeenCalledWith(SocketEvents.WaitingRoomDirectoryUpdated, expect.any(Function));
    });

    it('forwards waiting-room service events to sockets', () => {
        handlers[SocketEvents.WaitingRoomUpdated]?.({
            accessCode: 'ABC123',
            payload: { accessCode: 'ABC123' },
        });
        handlers[SocketEvents.WaitingRoomMessageSent]?.({
            accessCode: 'ABC123',
            payload: { content: 'hello' },
        });
        handlers[SocketEvents.WaitingRoomError]?.({
            socketId: 'socket-1',
            payload: { message: 'bad' },
        });
        handlers[SocketEvents.WaitingRoomPlayerKicked]?.({
            accessCode: 'ABC123',
            kickedSocketId: 'socket-2',
        });
        handlers[SocketEvents.WaitingRoomCancelled]?.({ accessCode: 'ABC123' });
        handlers[SocketEvents.WaitingRoomGameStarted]?.({
            accessCode: 'ABC123',
            sessionId: 'session-1',
            messages: [],
        });
        handlers[SocketEvents.WaitingRoomDirectoryUpdated]?.({});

        expect(serverToEmit).toHaveBeenCalledWith(SocketEvents.WaitingRoomUpdated, { accessCode: 'ABC123' });
        expect(serverToEmit).toHaveBeenCalledWith(SocketEvents.WaitingRoomMessageSent, { content: 'hello' });
        expect(serverToEmit).toHaveBeenCalledWith(SocketEvents.WaitingRoomError, { message: 'bad' });
        expect(serverToEmit).toHaveBeenCalledWith(
            SocketEvents.WaitingRoomPlayerKicked,
            { message: 'Vous avez ete exclu de la salle d attente par l organisateur.' },
        );
        expect(serverToEmit).toHaveBeenCalledWith(
            SocketEvents.WaitingRoomCancelled,
            { message: 'La salle d attente a ete fermee.' },
        );
        expect(serverToEmit).toHaveBeenCalledWith(
            SocketEvents.WaitingRoomGameStarted,
            { accessCode: 'ABC123', sessionId: 'session-1', messages: [] },
        );
        expect(serverInSocketsLeave).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(serverEmit).toHaveBeenCalledWith(SocketEvents.WaitingRoomDirectoryUpdated);
    });

    it('delegates disconnect handling', () => {
        gateway.handleDisconnect(makeSocket('socket-1'));
        expect(waitingRoomService.handleDisconnect).toHaveBeenCalledWith('socket-1');
    });

    it('creates a waiting room, joins its socket room, and emits current state', async () => {
        const client = makeSocket('socket-1');
        waitingRoomService.createWaitingRoom.mockResolvedValue('ABC123');
        waitingRoomService.getWaitingRoomState.mockReturnValue({ accessCode: 'ABC123' });

        await gateway.createWaitingRoom(client, makeCreatePayload());

        expect(waitingRoomService.createWaitingRoom).toHaveBeenCalledWith('socket-1', makeCreatePayload());
        expect(client.join).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(client.emit).toHaveBeenCalledWith(SocketEvents.WaitingRoomUpdated, { accessCode: 'ABC123' });
    });

    it('handles createWaitingRoom failures', async () => {
        const client = makeSocket('socket-1');
        waitingRoomService.createWaitingRoom.mockRejectedValue(new Error('boom'));

        await gateway.createWaitingRoom(client, makeCreatePayload());

        expect(logger.error).toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(
            SocketEvents.WaitingRoomError,
            { message: 'Impossible de creer la salle d attente.' },
        );
    });

    it('joins a waiting room only when the service accepts it', () => {
        const client = makeSocket('socket-2');
        waitingRoomService.joinWaitingRoom.mockReturnValue(true);
        waitingRoomService.getWaitingRoomState.mockReturnValue({ accessCode: 'ABC123', players: [] });

        gateway.joinWaitingRoom(client, {
            accessCode: 'ABC123',
            player: makeCreatePayload().player,
        });

        expect(client.join).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(client.emit).toHaveBeenCalledWith(SocketEvents.WaitingRoomUpdated, { accessCode: 'ABC123', players: [] });

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
        const client = makeSocket('socket-3');

        gateway.leaveWaitingRoom(client, { accessCode: 'ABC123' });
        gateway.kickPlayer(client, { accessCode: 'ABC123', playerId: 'player-2' });
        gateway.sendMessage(client, { accessCode: 'ABC123', content: 'hello' });

        expect(waitingRoomService.leaveWaitingRoom).toHaveBeenCalledWith('socket-3', 'ABC123');
        expect(client.leave).toHaveBeenCalledWith(getWaitingRoomRoom('ABC123'));
        expect(waitingRoomService.kickPlayer).toHaveBeenCalledWith('socket-3', { accessCode: 'ABC123', playerId: 'player-2' });
        expect(waitingRoomService.addMessage).toHaveBeenCalledWith('socket-3', { accessCode: 'ABC123', content: 'hello' });
    });

    it('starts a waiting room game and emits an error on failure', async () => {
        const client = makeSocket('socket-4');

        await gateway.startGame(client, { accessCode: 'ABC123' });
        expect(waitingRoomService.startGame).toHaveBeenCalledWith('socket-4', 'ABC123');

        waitingRoomService.startGame.mockRejectedValue(new Error('boom'));
        await gateway.startGame(client, { accessCode: 'ABC123' });

        expect(logger.error).toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(
            SocketEvents.WaitingRoomError,
            { message: 'Impossible de lancer la partie.' },
        );
    });
});
