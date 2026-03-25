import { GameSessionGateway } from '@app/gateways/game-session/game-session.gateway';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { Logger } from '@nestjs/common';
import {
    DebugTeleportPlayerPayload,
    EndGameTurnPayload,
    ForceEndDebugTurnPayload,
    GameSessionSnapshotPayload,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    SocketEvents,
    StartCombatPayload,
    SurrenderGamePayload,
    ToggleDebugModePayload,
    ToggleDoorPayload,
    getGameSessionRoom,
} from '@common/socket-events';
import { Server, Socket } from 'socket.io';

const makeSocket = (id: string): Socket => ({
    id,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
} as unknown as Socket);

describe('GameSessionGateway', () => {
    let gateway: GameSessionGateway;
    let gameSessionService: Record<string, jest.Mock>;
    let logger: { log: jest.Mock };
    let serverToEmit: jest.Mock;
    let handlers: Record<string, ((payload: unknown) => void) | undefined>;

    beforeEach(() => {
        handlers = {};
        gameSessionService = {
            on: jest.fn((event: string, handler: (payload: unknown) => void) => {
                handlers[event] = handler;
            }),
            off: jest.fn(),
            removeSocket: jest.fn(),
            surrender: jest.fn(),
            registerSocket: jest.fn(),
            getPlayerIdForSocket: jest.fn(),
            toggleDebugMode: jest.fn(),
            forceEndDebugTurn: jest.fn(),
            debugTeleportPlayer: jest.fn(),
            movePlayer: jest.fn(),
            endTurn: jest.fn(),
            startCombat: jest.fn(),
            toggleDoor: jest.fn(),
        };
        logger = { log: jest.fn() };
        serverToEmit = jest.fn();
        const server = {
            to: jest.fn().mockReturnValue({ emit: serverToEmit }),
        } as unknown as Server;

        gateway = new GameSessionGateway(gameSessionService as never, logger as never);
        (gateway as unknown as { server: Server }).server = server;
    });

    it('subscribes to snapshots and forwards them to the session room', () => {
        const payload: GameSessionSnapshotPayload = {
            sessionId: 'session-1',
            match: {} as never,
            turnState: {} as never,
            messages: [],
        };

        handlers[SocketEvents.GameSessionSnapshot]?.(payload);

        expect(gameSessionService.on).toHaveBeenCalledWith(SocketEvents.GameSessionSnapshot, expect.any(Function));
        expect(serverToEmit).toHaveBeenCalledWith(SocketEvents.GameSessionSnapshot, payload);
    });

    it('unsubscribes on destroy', () => {
        gateway.onModuleDestroy();
        expect(gameSessionService.off).toHaveBeenCalledWith(SocketEvents.GameSessionSnapshot, expect.any(Function));
    });

    it('handles disconnects and surrenders when the socket belonged to a player', () => {
        gameSessionService.removeSocket.mockReturnValueOnce(null).mockReturnValueOnce({
            sessionId: 'session-1',
            playerId: 'player-1',
        });

        gateway.handleDisconnect(makeSocket('socket-1'));
        gateway.handleDisconnect(makeSocket('socket-2'));

        expect(logger.log).toHaveBeenCalledWith('Client socket-1 disconnected.');
        expect(gameSessionService.surrender).toHaveBeenCalledWith('session-1', 'player-1');
    });

    it('joins a game session and emits an initial snapshot', () => {
        const client = makeSocket('socket-1');
        const payload: JoinGameSessionPayload = { sessionId: 'session-1', playerId: 'player-1' };
        gameSessionService.registerSocket.mockReturnValue({
            match: { id: 'match' },
            turnState: { id: 'turn' },
            messages: [{ id: 'msg-1' }],
        });

        gateway.joinSession(client, payload);

        expect(gameSessionService.registerSocket).toHaveBeenCalledWith('session-1', 'player-1', 'socket-1');
        expect(client.join).toHaveBeenCalledWith(getGameSessionRoom('session-1'));
        expect(client.emit).toHaveBeenCalledWith(SocketEvents.GameSessionSnapshot, {
            sessionId: 'session-1',
            match: { id: 'match' },
            turnState: { id: 'turn' },
            messages: [{ id: 'msg-1' }],
        });

        gameSessionService.registerSocket.mockImplementation(() => {
            throw new Error('boom');
        });
        gateway.joinSession(client, payload);
        expect(client.emit).toHaveBeenCalledWith(
            SocketEvents.GameSessionError,
            { message: 'Impossible de joindre la session de jeu.' },
        );
    });

    it('guards every player action behind socket ownership and service success', () => {
        const client = makeSocket('socket-1');
        const gatewayAny = gateway as any;
        const cases = [
            {
                method: 'toggleDebugMode',
                serviceMethod: 'toggleDebugMode',
                payload: { sessionId: 'session-1', playerId: 'player-1' } satisfies ToggleDebugModePayload,
                error: 'Mode debug refuse.',
            },
            {
                method: 'forceEndDebugTurn',
                serviceMethod: 'forceEndDebugTurn',
                payload: { sessionId: 'session-1', playerId: 'player-1' } satisfies ForceEndDebugTurnPayload,
                error: 'Fin de tour debug refusee.',
            },
            {
                method: 'debugTeleportPlayer',
                serviceMethod: 'debugTeleportPlayer',
                payload: { sessionId: 'session-1', playerId: 'player-1', position: { x: 1, y: 1 } } satisfies DebugTeleportPlayerPayload,
                error: 'Teleportation debug refusee.',
            },
            {
                method: 'movePlayer',
                serviceMethod: 'movePlayer',
                payload: { sessionId: 'session-1', playerId: 'player-1', direction: 'right' } satisfies MoveGamePlayerPayload,
                error: 'Deplacement refuse.',
            },
            {
                method: 'endTurn',
                serviceMethod: 'endTurn',
                payload: { sessionId: 'session-1', playerId: 'player-1' } satisfies EndGameTurnPayload,
                error: 'Fin de tour refusee.',
            },
            {
                method: 'startCombat',
                serviceMethod: 'startCombat',
                payload: { sessionId: 'session-1', playerId: 'player-1', defenderId: 'player-2' } satisfies StartCombatPayload,
                error: 'Combat refuse.',
            },
            {
                method: 'toggleDoor',
                serviceMethod: 'toggleDoor',
                payload: { sessionId: 'session-1', playerId: 'player-1', position: { x: 0, y: 1 } } satisfies ToggleDoorPayload,
                error: 'Action de porte refusee.',
            },
        ] as const;

        for (const testCase of cases) {
            gameSessionService.getPlayerIdForSocket.mockReturnValue('other-player');
            gatewayAny[testCase.method](client, testCase.payload);
            expect(client.emit).toHaveBeenLastCalledWith(SocketEvents.GameSessionError, { message: testCase.error });

            gameSessionService.getPlayerIdForSocket.mockReturnValue('player-1');
            gameSessionService[testCase.serviceMethod].mockReturnValue(false);
            gatewayAny[testCase.method](client, testCase.payload);
            expect(client.emit).toHaveBeenLastCalledWith(SocketEvents.GameSessionError, { message: testCase.error });

            gameSessionService[testCase.serviceMethod].mockReturnValue(true);
            (client.emit as jest.Mock).mockClear();
            gatewayAny[testCase.method](client, testCase.payload);
            expect(client.emit).not.toHaveBeenCalled();
        }
    });

    it('only lets the owning player surrender and leaves the room on success', () => {
        const client = makeSocket('socket-1');
        const payload: SurrenderGamePayload = { sessionId: 'session-1', playerId: 'player-1' };

        gameSessionService.getPlayerIdForSocket.mockReturnValue('other-player');
        gateway.surrender(client, payload);
        expect(client.emit).toHaveBeenCalledWith(SocketEvents.GameSessionError, { message: 'Abandon refuse.' });

        gameSessionService.getPlayerIdForSocket.mockReturnValue('player-1');
        gameSessionService.surrender.mockReturnValue(false);
        gateway.surrender(client, payload);
        expect(client.emit).toHaveBeenCalledWith(SocketEvents.GameSessionError, { message: 'Abandon refuse.' });

        (client.emit as jest.Mock).mockClear();
        gameSessionService.surrender.mockReturnValue(true);
        gateway.surrender(client, payload);
        expect(client.leave).toHaveBeenCalledWith(getGameSessionRoom('session-1'));
        expect(client.emit).not.toHaveBeenCalled();
    });
});
