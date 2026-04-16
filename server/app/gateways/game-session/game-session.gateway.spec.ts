import { GameSessionGateway } from '@app/gateways/game-session/game-session.gateway';
import { CombatService } from '@app/services/combat/combat.service';
import { EndStatsService } from '@app/services/end-stats.service';
import { createMockSocket } from '@app/utilities/mocks/mocks';
import {
    DebugTeleportPlayerPayload,
    EndGameTurnPayload,
    ForceEndDebugTurnPayload,
    GameSessionSnapshotPayload,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    ResolveSanctuaryChoicePayload,
    SessionSocketEvents,
    SurrenderGamePayload,
    ToggleDebugModePayload,
    ToggleDoorPayload,
    UseSanctuaryPayload,
    getGameSessionRoom,
} from '@common/socket-events';
import { Server } from 'socket.io';

describe('GameSessionGateway', () => {
    let gateway: GameSessionGateway;
    let gameSessionService: Record<string, jest.Mock>;
    let mockCombatService: Partial<CombatService>;
    let mockEndStatsService: Partial<EndStatsService>;
    let serverToEmit: jest.Mock;
    let handlers: Record<string, ((payload: unknown) => void) | undefined>;

    beforeEach(() => {
        handlers = {};
        mockCombatService = {
            handleDisconnect: jest.fn(),
        };
        mockEndStatsService = {
            endGame: jest.fn(),
        };
        gameSessionService = {
            on: jest.fn((event: string, handler: (payload: unknown) => void) => {
                handlers[event] = handler;
            }),
            off: jest.fn(),
            findSessionIdForSocket: jest.fn(),
            removeSocket: jest.fn(),
            surrender: jest.fn(),
            registerSocket: jest.fn(),
            getSocketIdsForSession: jest.fn(),
            getSnapshotForSocket: jest.fn(),
            getPlayerIdForSocket: jest.fn(),
            toggleDebugMode: jest.fn(),
            forceEndDebugTurn: jest.fn(),
            debugTeleportPlayer: jest.fn(),
            movePlayer: jest.fn(),
            endTurn: jest.fn(),
            useSanctuary: jest.fn(),
            resolveSanctuaryChoice: jest.fn(),
            startCombat: jest.fn(),
            toggleDoor: jest.fn(),
        };
        serverToEmit = jest.fn();
        const server = {
            to: jest.fn().mockReturnValue({ emit: serverToEmit }),
        } as unknown as Server;

        gateway = new GameSessionGateway(gameSessionService as never, mockEndStatsService as never, mockCombatService as never);
        (gateway as unknown as { server: Server }).server = server;
        gateway.onModuleInit();
    });

    it('subscribes to snapshots and forwards filtered snapshots to each session socket', () => {
        const payload: GameSessionSnapshotPayload = {
            sessionId: 'session-1',
            match: {} as never,
            turnState: {} as never,
            messages: [],
            logEntries: [],
        };
        gameSessionService.getSocketIdsForSession.mockReturnValue(['socket-1', 'socket-2']);
        gameSessionService.getSnapshotForSocket
            .mockReturnValueOnce({ ...payload, logEntries: [{ id: 'log-1' }] })
            .mockReturnValueOnce({ ...payload, logEntries: [] });

        handlers[SessionSocketEvents.GameSessionSnapshot]?.(payload);

        expect(gameSessionService.on).toHaveBeenCalledWith(SessionSocketEvents.GameSessionSnapshot, expect.any(Function));
        expect(serverToEmit).toHaveBeenNthCalledWith(1, SessionSocketEvents.GameSessionSnapshot, { ...payload, logEntries: [{ id: 'log-1' }] });
        expect(serverToEmit).toHaveBeenNthCalledWith(2, SessionSocketEvents.GameSessionSnapshot, { ...payload, logEntries: [] });
    });

    it('unsubscribes on destroy', () => {
        gateway.onModuleDestroy();
        expect(gameSessionService.off).toHaveBeenCalledWith(SessionSocketEvents.GameSessionSnapshot, expect.any(Function));
    });

    it('handles disconnects and surrenders when the socket belonged to a player', () => {
        gameSessionService.removeSocket.mockReturnValueOnce({
            sessionId: 'session-1',
            playerId: 'player-1',
        });

        gateway.handleDisconnect(createMockSocket('socket-1'));
        gateway.handleDisconnect(createMockSocket('socket-2'));

        expect(gameSessionService.surrender).toHaveBeenCalledWith('session-1', 'player-1');
    });

    it('joins a game session and emits an initial snapshot', () => {
        const client = createMockSocket('socket-1');
        const payload: JoinGameSessionPayload = { sessionId: 'session-1', playerId: 'player-1' };
        gameSessionService.registerSocket.mockReturnValue({
            snapshot: {
                sessionId: 'session-1',
                match: { id: 'match' },
                turnState: { id: 'turn' },
                messages: [{ id: 'msg-1' }],
                logEntries: [{ id: 'log-1' }],
            },
            previousSessionId: null,
        });

        gateway.joinSession(client, payload);

        expect(gameSessionService.registerSocket).toHaveBeenCalledWith('session-1', 'player-1', 'socket-1');
        expect(client.join).toHaveBeenCalledWith(getGameSessionRoom('session-1'));
        expect(client.emit).toHaveBeenCalledWith(SessionSocketEvents.GameSessionSnapshot, {
            sessionId: 'session-1',
            match: { id: 'match' },
            turnState: { id: 'turn' },
            messages: [{ id: 'msg-1' }],
            logEntries: [{ id: 'log-1' }],
        });

        gameSessionService.registerSocket.mockImplementation(() => {
            throw new Error('boom');
        });
        gateway.joinSession(client, payload);
        expect(client.emit).toHaveBeenCalledWith(
            SessionSocketEvents.GameSessionError,
            { message: 'Impossible de joindre la session de jeu.' },
        );
    });

    it('leaves the previous game room when migrating a socket to another session', () => {
        const client = createMockSocket('socket-1');
        gameSessionService.registerSocket.mockReturnValue({
            snapshot: {
                sessionId: 'session-1',
                match: { id: 'match' },
                turnState: { id: 'turn' },
                messages: [],
                logEntries: [],
            },
            previousSessionId: 'session-0',
        });

        gateway.joinSession(client, { sessionId: 'session-1', playerId: 'player-1' });

        expect(client.leave).toHaveBeenCalledWith(getGameSessionRoom('session-0'));
        expect(client.join).toHaveBeenCalledWith(getGameSessionRoom('session-1'));
    });

    it('guards every player action behind socket ownership and service success', () => {
        const client = createMockSocket('socket-1');
        const actions = {
            debugTeleportPlayer: gateway.debugTeleportPlayer.bind(gateway),
            endTurn: gateway.endTurn.bind(gateway),
            forceEndDebugTurn: gateway.forceEndDebugTurn.bind(gateway),
            movePlayer: gateway.movePlayer.bind(gateway),
            resolveSanctuaryChoice: gateway.resolveSanctuaryChoice.bind(gateway),
            toggleDebugMode: gateway.toggleDebugMode.bind(gateway),
            toggleDoor: gateway.toggleDoor.bind(gateway),
            useSanctuary: gateway.useSanctuary.bind(gateway),
        };
        const cases = [
            {
                action: actions.toggleDebugMode,
                serviceMethod: 'toggleDebugMode',
                payload: { sessionId: 'session-1', playerId: 'player-1' } satisfies ToggleDebugModePayload,
                error: 'Mode debug refuse.',
            },
            {
                action: actions.forceEndDebugTurn,
                serviceMethod: 'forceEndDebugTurn',
                payload: { sessionId: 'session-1', playerId: 'player-1' } satisfies ForceEndDebugTurnPayload,
                error: 'Fin de tour debug refusee.',
            },
            {
                action: actions.debugTeleportPlayer,
                serviceMethod: 'debugTeleportPlayer',
                payload: { sessionId: 'session-1', playerId: 'player-1', position: { x: 1, y: 1 } } satisfies DebugTeleportPlayerPayload,
                error: 'Teleportation debug refusee.',
            },
            {
                action: actions.movePlayer,
                serviceMethod: 'movePlayer',
                payload: { sessionId: 'session-1', playerId: 'player-1', direction: 'right' } satisfies MoveGamePlayerPayload,
                error: 'Deplacement refuse.',
            },
            {
                action: actions.endTurn,
                serviceMethod: 'endTurn',
                payload: { sessionId: 'session-1', playerId: 'player-1' } satisfies EndGameTurnPayload,
                error: 'Fin de tour refusee.',
            },
            {
                action: actions.useSanctuary,
                serviceMethod: 'useSanctuary',
                payload: { sessionId: 'session-1', playerId: 'player-1', sanctuaryId: 7 } satisfies UseSanctuaryPayload,
                error: 'Action de sanctuaire refusee.',
            },
            {
                action: actions.resolveSanctuaryChoice,
                serviceMethod: 'resolveSanctuaryChoice',
                payload: {
                    sessionId: 'session-1',
                    playerId: 'player-1',
                    choice: 'normal',
                } satisfies ResolveSanctuaryChoicePayload,
                error: 'Choix de sanctuaire refuse.',
            },
            {
                action: actions.toggleDoor,
                serviceMethod: 'toggleDoor',
                payload: { sessionId: 'session-1', playerId: 'player-1', position: { x: 0, y: 1 } } satisfies ToggleDoorPayload,
                error: 'Action de porte refusee.',
            },
        ] as const;

        for (const testCase of cases) {
            gameSessionService.getPlayerIdForSocket.mockReturnValue('other-player');
            testCase.action(client, testCase.payload);
            expect(client.emit).toHaveBeenLastCalledWith(SessionSocketEvents.GameSessionError, { message: testCase.error });

            gameSessionService.getPlayerIdForSocket.mockReturnValue('player-1');
            gameSessionService[testCase.serviceMethod].mockReturnValue(false);
            testCase.action(client, testCase.payload);
            expect(client.emit).toHaveBeenLastCalledWith(SessionSocketEvents.GameSessionError, { message: testCase.error });

            gameSessionService[testCase.serviceMethod].mockReturnValue(true);
            (client.emit as jest.Mock).mockClear();
            testCase.action(client, testCase.payload);
            expect(client.emit).not.toHaveBeenCalled();
        }
    });

    it('only lets the owning player surrender and leaves the room on success', () => {
        const client = createMockSocket('socket-1');
        const payload: SurrenderGamePayload = { sessionId: 'session-1', playerId: 'player-1' };

        gameSessionService.getPlayerIdForSocket.mockReturnValue('other-player');
        gateway.surrender(client, payload);
        expect(client.emit).toHaveBeenCalledWith(SessionSocketEvents.GameSessionError, { message: 'Abandon refuse.' });

        gameSessionService.getPlayerIdForSocket.mockReturnValue('player-1');
        gameSessionService.surrender.mockReturnValue(false);
        gateway.surrender(client, payload);
        expect(client.emit).toHaveBeenCalledWith(SessionSocketEvents.GameSessionError, { message: 'Abandon refuse.' });

        (client.emit as jest.Mock).mockClear();
        gameSessionService.surrender.mockReturnValue(true);
        gateway.surrender(client, payload);
        expect(client.leave).toHaveBeenCalledWith(getGameSessionRoom('session-1'));
        expect(client.emit).not.toHaveBeenCalled();
    });
});
