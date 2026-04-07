import { EndStatsService } from '@app/services/end-stats.service';
import { MapService } from '@app/services/map/map.service';
import { InitializedMatch, MatchLobbyPlayer } from '@common/game/match.interface';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMapDetails } from '@common/maps/map.interface';
import { GameSessionSnapshotPayload, SessionSocketEvents } from '@common/socket-events';
import { ATTACK_POSE_DURATION_MS, WALK_POSE_DURATION_MS } from './game-session.match';
import { TRANSITION_DURATION_MS } from './game-session.runtime';
import { GameSessionService } from './game-session.service';

const START_LEFT_X = 1;
const START_RIGHT_X = 2;
const START_Y = 1;
const MOVE_DOWN_Y = 2;
const TELEPORT_X = 3;
const GRID_WIDTH = MapSize.S;
const GRID_HEIGHT = MapSize.S;
const FAST_SPEED = 8;
const NORMAL_SPEED = 6;

const createCells = (): EditorCell[] => {
    const cells: EditorCell[] = [];

    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            cells.push({
                position: { x, y },
                tileType: TileType.DIRT,
                isWalkable: true,
                isOccupied: false,
            });
        }
    }

    return cells;
};

const createPlayers = (): MatchLobbyPlayer[] => [
    {
        id: 'player-1',
        name: 'Alpha',
        avatarId: 0,
        isOrganizer: true,
        speed: FAST_SPEED,
        maxHealth: 6,
        baseAttack: 4,
        baseDefense: 4,
        attackDie: 'D6',
        defenseDie: 'D4',
        controller: 'human',
    },
    {
        id: 'player-2',
        name: 'Bravo',
        avatarId: 1,
        isOrganizer: false,
        speed: NORMAL_SPEED,
        maxHealth: 6,
        baseAttack: 4,
        baseDefense: 4,
        attackDie: 'D6',
        defenseDie: 'D4',
        controller: 'human',
    },
];

const createMap = (): EditorMapDetails => ({
    id: 'map-1',
    name: 'Arena',
    description: 'Test map',
    mode: GameMode.CLASSIC,
    mapsize: MapSize.S,
    map: createCells(),
    objects: [
        { id: 1, type: ObjectType.START, position: { x: START_LEFT_X, y: START_Y }, size: ObjectSize.S },
        { id: 2, type: ObjectType.START, position: { x: START_RIGHT_X, y: START_Y }, size: ObjectSize.S },
    ],
});

const createDoorMap = (): EditorMapDetails => ({
    ...createMap(),
    map: createCells().map((cell) =>
        cell.position.x === START_RIGHT_X && cell.position.y === START_Y
            ? { ...cell, tileType: TileType.DOOR, isWalkable: false }
            : cell,
    ),
    objects: [{ id: 1, type: ObjectType.START, position: { x: START_LEFT_X, y: START_Y }, size: ObjectSize.S }],
});

describe('GameSessionService', () => {
    let service: GameSessionService;
    let mapService: jest.Mocked<Pick<MapService, 'getMapByIdForEditor'>>;
    let endStatsService: { startGame: jest.Mock, startCombat: jest.Mock, visitTile: jest.Mock, useDoor: jest.Mock };
    let snapshots: { sessionId: string; match: InitializedMatch }[];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-24T12:00:00.000Z'));
        mapService = {
            getMapByIdForEditor: jest.fn().mockResolvedValue(createMap()),
        };
        endStatsService = {
            startGame: jest.fn().mockResolvedValue(null),
            startCombat: jest.fn().mockReturnValue(null),
            visitTile: jest.fn().mockReturnValue(null),
            useDoor: jest.fn().mockReturnValue(null),
        };
        service = new GameSessionService(mapService as unknown as MapService, endStatsService as unknown as EndStatsService);
        snapshots = [];
        service.on<GameSessionSnapshotPayload>(SessionSocketEvents.GameSessionSnapshot, (payload) => {
            snapshots.push({ sessionId: payload.sessionId, match: payload.match });
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('initializes players with default render metadata', async () => {
        const sessionId = await service.createSessionFromWaitingRoom('map-1', createPlayers());
        const snapshot = snapshots.find((entry) => entry.sessionId === sessionId)?.match;

        expect(snapshot?.players.every((player) => player.render.facing === 'front' && player.render.pose === 'idle')).toBe(true);
    });

    it('syncs walk pose and facing through the snapshot on movement', async () => {
        const sessionId = await service.createSessionFromWaitingRoom('map-1', createPlayers());

        jest.advanceTimersByTime(TRANSITION_DURATION_MS);

        expect(service.movePlayer(sessionId, 'player-1', 'down')).toBe(true);

        const movedPlayer = snapshots.at(-1)?.match.players.find((player) => player.id === 'player-1');

        expect(movedPlayer?.position.y).toBe(MOVE_DOWN_Y);
        expect(movedPlayer?.render.facing).toBe('front');
        expect(movedPlayer?.render.pose).toBe('walk');
        expect(movedPlayer?.render.poseDurationMs).toBe(WALK_POSE_DURATION_MS);
        expect(movedPlayer?.render.poseStartedAt).toBe(new Date().toISOString());
    });

    it('syncs attack pose and facing when toggling an adjacent door', async () => {
        mapService.getMapByIdForEditor.mockResolvedValue(createDoorMap());
        const sessionId = await service.createSessionFromWaitingRoom('map-1', [createPlayers()[0]]);

        jest.advanceTimersByTime(TRANSITION_DURATION_MS);

        expect(service.toggleDoor(sessionId, 'player-1', { x: START_RIGHT_X, y: START_Y })).toBe(true);

        const player = snapshots.at(-1)?.match.players[0];

        expect(player?.render.facing).toBe('right');
        expect(player?.render.pose).toBe('attack');
        expect(player?.render.poseDurationMs).toBe(ATTACK_POSE_DURATION_MS);
    });

    it('syncs attack pose and defender-facing direction on combat', async () => {
        const sessionId = await service.createSessionFromWaitingRoom('map-1', createPlayers());

        jest.advanceTimersByTime(TRANSITION_DURATION_MS);

        expect(service.startCombat(sessionId, 'player-1', 'player-2')).toBe(true);

        const attacker = snapshots.at(-1)?.match.players.find((player) => player.id === 'player-1');
        const defender = snapshots.at(-1)?.match.players.find((player) => player.id === 'player-2');
        const expectedFacing = attacker && defender && attacker.position.x < defender.position.x ? 'right' : 'left';

        expect(attacker?.render.facing).toBe(expectedFacing);
        expect(attacker?.render.pose).toBe('attack');
        expect(attacker?.render.poseDurationMs).toBe(ATTACK_POSE_DURATION_MS);
    });

    it('syncs facing on debug teleport without local-only client help', async () => {
        const sessionId = await service.createSessionFromWaitingRoom('map-1', [createPlayers()[0]]);

        jest.advanceTimersByTime(TRANSITION_DURATION_MS);

        expect(service.toggleDebugMode(sessionId, 'player-1')).toBe(true);
        expect(service.debugTeleportPlayer(sessionId, 'player-1', { x: TELEPORT_X, y: START_Y })).toBe(true);

        const player = snapshots.at(-1)?.match.players[0];

        expect(player?.position).toEqual({ x: TELEPORT_X, y: START_Y });
        expect(player?.render.facing).toBe('right');
        expect(player?.render.pose).toBe('idle');
    });
});
