import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameSessionRuntime } from '@app/services/game-session/game-session.runtime';
import * as runtimeModule from '@app/services/game-session/game-session.runtime';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMapDetails, MapObject } from '@common/maps/map.interface';

export const ACTIVE_TURN_MS = 5000;
export const MOVEMENT_POINTS_AFTER_MOVE = 3;

export type GameSessionServiceInternals = GameSessionService & {
    advanceToNextTurn: (...args: unknown[]) => unknown;
    emitSnapshot: (...args: unknown[]) => unknown;
    startTransition: (...args: unknown[]) => unknown;
};

export type GameSessionServicePrivateState = {
    sessions: Map<string, GameSessionRuntime>;
};

export const makeLobbyPlayer = (overrides: Partial<MatchLobbyPlayer> = {}): MatchLobbyPlayer => ({
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

export const makeMatchPlayer = (overrides: Partial<MatchPlayer> = {}): MatchPlayer => ({
    ...makeLobbyPlayer(),
    position: { x: 0, y: 0 },
    startingPosition: { x: 0, y: 0 },
    health: 6,
    combatWins: 0,
    ...overrides,
});

export const makeCell = (x: number, y: number, tileType: TileType = TileType.DIRT, isWalkable = true): EditorCell => ({
    position: { x, y },
    tileType,
    isWalkable,
    isOccupied: false,
});

export const makeObject = (overrides: Partial<MapObject> = {}): MapObject => ({
    id: 1,
    type: ObjectType.START,
    position: { x: 0, y: 0 },
    size: ObjectSize.S,
    ...overrides,
});

export const makeMapDetails = (): EditorMapDetails => ({
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

export const makeMatch = (overrides: Partial<InitializedMatch> = {}): InitializedMatch => {
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

export const makeTurnState = (overrides: Partial<MatchTurnState> = {}): MatchTurnState => ({
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

export const makeRuntime = (overrides: Partial<GameSessionRuntime> = {}): GameSessionRuntime => ({
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

export function createGameSessionServiceHarness() {
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

    return {
        get service() {
            return service;
        },
        get mapService() {
            return mapService;
        },
        getPrivateState(): GameSessionServicePrivateState {
            return service as unknown as GameSessionServicePrivateState;
        },
        getServiceInternals(): GameSessionServiceInternals {
            return service as unknown as GameSessionServiceInternals;
        },
    };
}

export { runtimeModule };
