import { AVATAR_IDS } from '@common/character/character.model';
import { MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { PlayerTurnInteractionState } from '@common/game/turn.interface';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMapDetails, MapObject, MapSummary } from '@common/maps/map.interface';

export const TEST_BASE_HEALTH = 6;
export const TEST_BASE_ATTACK = 4;
export const TEST_BASE_DEFENSE = 4;
export const TEST_FAST_SPEED = 8;
export const TEST_NORMAL_SPEED = 6;
export const TEST_FULL_TURN_MS = 30000;
export const TEST_SMALL_RANDOM = 0;
export const TEST_TEAM_RANDOM = 0.25;
export const TEST_RELOAD_RANDOM = 0.4;
export const TEST_PERSISTED_RANDOM = 0.9;
export const TEST_DOOR_X = 6;
export const TEST_DOOR_Y = 6;

export const createMapCells = (size: MapSize): EditorCell[] => {
    const cells: EditorCell[] = [];

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
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

export const setTile = (cells: EditorCell[], x: number, y: number, patch: Partial<EditorCell>): void => {
    const cell = cells.find((candidate) => candidate.position.x === x && candidate.position.y === y);
    if (!cell) {
        return;
    }

    Object.assign(cell, patch);
};

export const createMap = (mode: GameMode = GameMode.CLASSIC): EditorMapDetails => {
    const cells = createMapCells(MapSize.S);
    setTile(cells, TEST_DOOR_X, TEST_DOOR_Y, { tileType: TileType.DOOR, isWalkable: false });

    const objects: MapObject[] = [
        { id: 1, type: ObjectType.START, position: { x: 1, y: 1 }, size: ObjectSize.S },
        { id: 2, type: ObjectType.START, position: { x: 3, y: 1 }, size: ObjectSize.S },
        { id: 3, type: ObjectType.START, position: { x: 5, y: 1 }, size: ObjectSize.S },
        { id: 4, type: ObjectType.START, position: { x: 7, y: 1 }, size: ObjectSize.S },
    ];

    return {
        id: 'map-1',
        name: 'Arena',
        description: 'Test map',
        mode,
        mapsize: MapSize.S,
        map: cells,
        objects,
    };
};

export const createPlayers = (count: number): MatchLobbyPlayer[] =>
    Array.from({ length: count }, (_, index) => ({
        id: `player-${index + 1}`,
        name: `Player ${index + 1}`,
        avatarId: AVATAR_IDS[index % AVATAR_IDS.length],
        isOrganizer: index === 0,
        speed: index % 2 === 0 ? TEST_FAST_SPEED : TEST_NORMAL_SPEED,
        maxHealth: TEST_BASE_HEALTH,
        baseAttack: TEST_BASE_ATTACK,
        baseDefense: TEST_BASE_DEFENSE,
        attackDie: 'D6',
        defenseDie: 'D4',
        controller: 'human',
    }));

export const createSummary = (mode: GameMode = GameMode.CLASSIC): MapSummary => ({
    id: 'map-1',
    name: 'Arena',
    description: 'Test map',
    mode,
    size: MapSize.S,
    date: '2026-03-11T00:00:00.000Z',
    visibility: true,
});

export const createTurnState = (players: MatchPlayer[]) => ({
    matchId: 'map-1',
    hasStarted: true,
    order: players.map((player) => ({ playerId: player.id, speed: player.speed })),
    currentTurnIndex: 0,
    phase: 'active' as const,
    activePlayerId: players[0].id,
    transitionTargetPlayerId: null,
    transitionEndsAt: null,
    transitionRemainingMs: 0,
    activeTurnEndsAt: Date.now() + TEST_FULL_TURN_MS,
    activeTurnRemainingMs: TEST_FULL_TURN_MS,
    movementPointsRemaining: players[0].speed,
    actionTaken: false,
    movementCount: 0,
    playerStates: players.map((player, index) => ({
        playerId: player.id,
        state: index === 0 ? PlayerTurnInteractionState.Active : PlayerTurnInteractionState.Waiting,
    })),
});
