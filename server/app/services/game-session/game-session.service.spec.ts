/* eslint-disable max-lines */
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameSessionRuntime } from '@app/services/game-session/game-session.runtime';
import * as runtimeModule from '@app/services/game-session/game-session.runtime';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMapDetails, MapObject } from '@common/maps/map.interface';
import { NotFoundException } from '@nestjs/common';

const ACTIVE_TURN_MS = 5000;
const MOVEMENT_POINTS_AFTER_MOVE = 3;

type GameSessionServiceInternals = GameSessionService & {
    advanceToNextTurn: (...args: unknown[]) => unknown;
    emitSnapshot: (...args: unknown[]) => unknown;
    startTransition: (...args: unknown[]) => unknown;
};

type GameSessionServicePrivateState = {
    sessions: Map<string, GameSessionRuntime>;
};

const makeLobbyPlayer = (overrides: Partial<MatchLobbyPlayer> = {}): MatchLobbyPlayer => ({
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
    ...overrides,
});

const makeMatchPlayer = (overrides: Partial<MatchPlayer> = {}): MatchPlayer => ({
    ...makeLobbyPlayer(),
    position: { x: 0, y: 0 },
    startingPosition: { x: 0, y: 0 },
    health: 6,
    combatWins: 0,
    ...overrides,
});

const makeCell = (x: number, y: number, tileType: TileType = TileType.DIRT, isWalkable = true): EditorCell => ({
    position: { x, y },
    tileType,
    isWalkable,
    isOccupied: false,
});

const makeObject = (overrides: Partial<MapObject> = {}): MapObject => ({
    id: 1,
    type: ObjectType.START,
    position: { x: 0, y: 0 },
    size: ObjectSize.S,
    ...overrides,
});

const makeMapDetails = (): EditorMapDetails => ({
    id: 'map-1',
    name: 'Arena',
    description: 'desc',
    mode: GameMode.CLASSIC,
    mapsize: MapSize.S,
    map: [
        makeCell(0, 0),
        makeCell(1, 0),
        makeCell(0, 1),
        makeCell(1, 1),
    ],
    objects: [
        makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
        makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
    ],
});

const makeMatch = (overrides: Partial<InitializedMatch> = {}): InitializedMatch => {
    const players = [
        makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true, position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
        makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1, position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 } }),
    ];
    const allObjects = [
        makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
        makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
        makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 2, y: 2 } }),
    ];

    return {
        mapId: 'map-1',
        mapName: 'Arena',
        mode: GameMode.CLASSIC,
        mapSize: MapSize.S,
        debugMode: false,
        map: [
            makeCell(0, 0),
            makeCell(1, 0),
            makeCell(2, 0),
            makeCell(0, 1, TileType.DOOR, false),
            makeCell(1, 1, TileType.WATER),
            makeCell(2, 1, TileType.ICE),
            makeCell(0, 2),
            makeCell(1, 2),
            makeCell(2, 2),
        ],
        objects: allObjects.map((object) => ({ ...object, position: { ...object.position } })),
        allObjects: allObjects.map((object) => ({ ...object, position: { ...object.position } })),
        allStartingPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        players,
        endState: null,
        ...overrides,
    };
};

const makeTurnState = (overrides: Partial<MatchTurnState> = {}): MatchTurnState => ({
    matchId: 'map-1',
    hasStarted: true,
    order: [
        { playerId: 'player-1', speed: 4 },
        { playerId: 'player-2', speed: 3 },
    ],
    currentTurnIndex: 0,
    phase: 'active',
    activePlayerId: 'player-1',
    transitionTargetPlayerId: null,
    transitionEndsAt: null,
    transitionRemainingMs: 0,
    activeTurnEndsAt: Date.now() + ACTIVE_TURN_MS,
    activeTurnRemainingMs: ACTIVE_TURN_MS,
    movementPointsRemaining: 4,
    actionTaken: false,
    movementCount: 0,
    playerStates: [
        { playerId: 'player-1', state: 'active' },
        { playerId: 'player-2', state: 'waiting' },
    ],
    ...overrides,
});

const makeRuntime = (overrides: Partial<GameSessionRuntime> = {}): GameSessionRuntime => ({
    sessionId: 'session-1',
    match: makeMatch(),
    turnState: makeTurnState(),
    messages: [],
    socketToPlayerId: new Map(),
    transitionTimeoutId: null,
    activeTurnTimeoutId: null,
    timerIntervalId: null,
    ...overrides,
});

describe('GameSessionService', () => {
    let service: GameSessionService;
    let mapService: { getMapByIdForEditor: jest.Mock };

    beforeEach(() => {
        jest.useFakeTimers();
        mapService = {
            getMapByIdForEditor: jest.fn(),
        };
        service = new GameSessionService(mapService as never);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const getServiceInternals = (): GameSessionServiceInternals => service as unknown as GameSessionServiceInternals;
    const getPrivateState = (): GameSessionServicePrivateState => service as unknown as GameSessionServicePrivateState;

    it('creates a session from a waiting room, emits a snapshot, and starts transitions', async () => {
        const runtime = makeRuntime();
        const serviceInternals = getServiceInternals();
        const privateState = getPrivateState();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);
        const startTransitionSpy = jest.spyOn(serviceInternals, 'startTransition').mockImplementation((() => undefined) as never);
        jest.spyOn(runtimeModule, 'buildSession').mockReturnValue(runtime);
        mapService.getMapByIdForEditor.mockResolvedValue(makeMapDetails());

        const sessionId = await service.createSessionFromWaitingRoom('map-1', [makeLobbyPlayer()], []);

        expect(sessionId).toBe('session-1');
        expect(mapService.getMapByIdForEditor).toHaveBeenCalledWith('map-1');
        expect(privateState.sessions.get('session-1')).toBe(runtime);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
        expect(startTransitionSpy).toHaveBeenCalledWith(runtime);
    });

    it('registers sockets and resolves socket lookups', () => {
        const runtime = makeRuntime();
        getPrivateState().sessions.set(runtime.sessionId, runtime);

        const snapshot = service.registerSocket('session-1', 'player-1', 'socket-1');

        expect(snapshot).toEqual({
            match: runtime.match,
            turnState: runtime.turnState,
            messages: runtime.messages,
        });
        expect(service.getPlayerIdForSocket('socket-1', 'session-1')).toBe('player-1');
        expect(service.getPlayerNameForSocket('socket-1', 'session-1')).toBe('Alice');
        expect(service.findSessionIdForSocket('socket-1')).toBe('session-1');
        expect(() => service.registerSocket('missing', 'player-1', 'socket-x')).toThrow(NotFoundException);
        expect(() => service.registerSocket('session-1', 'ghost-player', 'socket-y')).toThrow(NotFoundException);
    });

    it('moves a socket membership to the latest joined session', () => {
        const firstRuntime = makeRuntime();
        const secondRuntime = makeRuntime({
            sessionId: 'session-2',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-4', name: 'Dan', avatarId: 3 }),
                ],
            }),
        });
        const privateState = getPrivateState();
        privateState.sessions.set(firstRuntime.sessionId, firstRuntime);
        privateState.sessions.set(secondRuntime.sessionId, secondRuntime);

        service.registerSocket('session-1', 'player-1', 'socket-1');
        service.registerSocket('session-2', 'player-3', 'socket-1');

        expect(firstRuntime.socketToPlayerId.has('socket-1')).toBe(false);
        expect(secondRuntime.socketToPlayerId.get('socket-1')).toBe('player-3');
    });

    it('removes sockets and keeps a player active when another socket is still linked', () => {
        const runtime = makeRuntime({
            socketToPlayerId: new Map([
                ['socket-1', 'player-1'],
                ['socket-2', 'player-1'],
            ]),
        });
        getPrivateState().sessions.set(runtime.sessionId, runtime);

        expect(service.removeSocket('missing')).toBeNull();
        expect(service.removeSocket('socket-1')).toBeNull();
        expect(service.removeSocket('socket-2')).toEqual({
            sessionId: 'session-1',
            playerId: 'player-1',
        });
    });

    it('ends the active turn only for the active player', () => {
        const runtime = makeRuntime();
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const advanceSpy = jest.spyOn(serviceInternals, 'advanceToNextTurn').mockImplementation((() => undefined) as never);

        expect(service.endTurn('missing', 'player-1')).toBe(false);
        expect(service.endTurn('session-1', 'player-2')).toBe(false);
        expect(service.endTurn('session-1', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(runtime);
    });

    it('handles surrender for empty, final, active, and inactive roster changes', () => {
        const serviceInternals = getServiceInternals();
        const privateState = getPrivateState();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);
        const startTransitionSpy = jest.spyOn(serviceInternals, 'startTransition').mockImplementation((() => undefined) as never);

        const emptyRuntime = makeRuntime({
            match: makeMatch({ players: [makeMatchPlayer({ id: 'player-1' })] }),
            turnState: makeTurnState({
                order: [{ playerId: 'player-1', speed: 4 }],
                playerStates: [{ playerId: 'player-1', state: 'active' }],
            }),
        });
        privateState.sessions.set('empty', emptyRuntime);
        expect(service.surrender('empty', 'player-1')).toBe(true);
        expect(privateState.sessions.has('empty')).toBe(false);

        const finalRuntime = makeRuntime({
            sessionId: 'final',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set('final', finalRuntime);
        expect(service.surrender('final', 'player-1')).toBe(true);
        expect(finalRuntime.match.endState?.winnerKind).toBe('none');
        expect(privateState.sessions.has('final')).toBe(false);

        const activeRuntime = makeRuntime({
            sessionId: 'active',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true, position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1, position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 } }),
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 } }),
                ],
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allStartingPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
            }),
            turnState: makeTurnState({
                activePlayerId: 'player-1',
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                    { playerId: 'player-3', speed: 2 },
                ],
                playerStates: [
                    { playerId: 'player-1', state: 'active' },
                    { playerId: 'player-2', state: 'waiting' },
                    { playerId: 'player-3', state: 'waiting' },
                ],
            }),
        });
        privateState.sessions.set('active', activeRuntime);
        expect(service.surrender('active', 'player-1')).toBe(true);
        expect(startTransitionSpy).toHaveBeenCalledWith(activeRuntime);

        const inactiveRuntime = makeRuntime({
            sessionId: 'inactive',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true, position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1, position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 } }),
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 } }),
                ],
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allStartingPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
            }),
            turnState: makeTurnState({
                activePlayerId: 'player-1',
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                    { playerId: 'player-3', speed: 2 },
                ],
                playerStates: [
                    { playerId: 'player-1', state: 'active' },
                    { playerId: 'player-2', state: 'waiting' },
                    { playerId: 'player-3', state: 'waiting' },
                ],
            }),
        });
        privateState.sessions.set('inactive', inactiveRuntime);
        expect(service.surrender('inactive', 'player-2')).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(inactiveRuntime);
        expect(service.surrender('missing', 'player-1')).toBe(false);
        expect(service.surrender('inactive', 'ghost')).toBe(false);
    });

    it('toggles debug mode only for the organizer', () => {
        const runtime = makeRuntime();
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(service.toggleDebugMode('session-1', 'player-2')).toBe(false);
        expect(service.toggleDebugMode('session-1', 'player-1')).toBe(true);
        expect(runtime.match.debugMode).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('forces debug turn ends only in valid debug sessions', () => {
        const runtime = makeRuntime({ match: makeMatch({ debugMode: true }) });
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const advanceSpy = jest.spyOn(serviceInternals, 'advanceToNextTurn').mockImplementation((() => undefined) as never);

        expect(service.forceEndDebugTurn('session-1', 'player-2')).toBe(false);
        expect(service.forceEndDebugTurn('session-1', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(runtime);
    });

    it('teleports the organizer in debug mode only to valid free cells', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                debugMode: true,
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 2, y: 2 } }),
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 2, y: 2 } }),
                ],
            }),
        });
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(service.debugTeleportPlayer('session-1', 'player-2', { x: 0, y: 1 })).toBe(false);
        expect(service.debugTeleportPlayer('session-1', 'player-1', { x: 9, y: 9 })).toBe(false);
        expect(service.debugTeleportPlayer('session-1', 'player-1', { x: 1, y: 0 })).toBe(false);
        expect(service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 1 })).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 2, y: 1 });
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('adds chat messages only to known sessions', () => {
        const runtime = makeRuntime();
        const message: ChatMessage = {
            id: 'msg-1',
            author: 'Alice',
            content: 'hello',
            createdAt: '2026-01-01T00:00:00.000Z',
        };
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(service.addChatMessage('missing', message)).toBeNull();
        expect(service.addChatMessage('session-1', message)).toEqual(message);
        expect(runtime.messages).toEqual([message]);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('moves the active player only when the destination is valid and affordable', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(service.movePlayer('missing', 'player-1', 'right')).toBe(false);
        expect(service.movePlayer('session-1', 'player-2', 'right')).toBe(false);

        runtime.turnState.movementPointsRemaining = 0;
        expect(service.movePlayer('session-1', 'player-1', 'right')).toBe(false);

        runtime.turnState.movementPointsRemaining = 4;
        expect(service.movePlayer('session-1', 'player-1', 'right')).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 1, y: 0 });
        expect(runtime.turnState.movementPointsRemaining).toBe(MOVEMENT_POINTS_AFTER_MOVE);
        expect(runtime.turnState.movementCount).toBe(1);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('toggles adjacent doors and consumes the player action', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        const serviceInternals = getServiceInternals();
        getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(service.toggleDoor('session-1', 'player-2', { x: 0, y: 1 })).toBe(false);
        expect(service.toggleDoor('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(service.toggleDoor('session-1', 'player-1', { x: 0, y: 1 })).toBe(true);
        expect(runtime.match.map.find((cell) => cell.position.x === 0 && cell.position.y === 1)?.isWalkable).toBe(true);
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('starts combat only for adjacent active players and finishes the match on the win threshold', () => {
        const serviceInternals = getServiceInternals();
        const privateState = getPrivateState();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, combatWins: 1, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set(runtime.sessionId, runtime);

        expect(service.startCombat('missing', 'player-1', 'player-2')).toBe(false);
        expect(service.startCombat('session-1', 'player-2', 'player-1')).toBe(false);
        expect(service.startCombat('session-1', 'player-1', 'player-2')).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.combatWins).toBe(2);
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);

        const winnerRuntime = makeRuntime({
            sessionId: 'winner',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, combatWins: 2, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set('winner', winnerRuntime);
        expect(service.startCombat('winner', 'player-1', 'player-2')).toBe(true);
        expect(privateState.sessions.has('winner')).toBe(false);
    });
});
