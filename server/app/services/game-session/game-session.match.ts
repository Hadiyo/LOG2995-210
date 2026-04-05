import { InitializedMatch, MatchLobbyPlayer, MatchPlayer, MatchSanctuaryState } from '@common/game/match.interface';
import { buildTeamAssignments, buildVisibleObjects } from '@common/game/match.utils';
import { ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorMapDetails, MapObject, Vec2 } from '@common/maps/map.interface';
import { PlayerFacing, PlayerPose, PlayerRenderState } from '@common/player/player.interface';

export const WALK_POSE_DURATION_MS = 180;
export const ATTACK_POSE_DURATION_MS = 220;
export const SANCTUARY_COOLDOWN_TURNS = 3;
export const SANCTUARY_DOUBLE_OR_NOTHING_THRESHOLD = 0.5;
export const ARENA_BUFF_TURNS = 2;
export const SANCTUARY_HEAL_VALUE = 2;

export function buildInitializedMatchFromEditor(
    map: EditorMapDetails,
    players: MatchLobbyPlayer[],
    random: () => number,
): InitializedMatch {
    const availableStartObjects = map.objects.filter((object) => object.type === ObjectType.START);
    if (availableStartObjects.length < players.length) {
        throw new Error('La carte ne contient pas assez de points de depart pour les joueurs actifs.');
    }

    const shuffledStarts = shuffle(availableStartObjects, random);
    const teamAssignments = buildTeamAssignments(players.length, map.mode, random);
    const initializedPlayers: MatchPlayer[] = players.map((player, index) => ({
        ...player,
        position: { ...shuffledStarts[index].position },
        startingPosition: { ...shuffledStarts[index].position },
        teamId: teamAssignments[index],
        health: player.maxHealth,
        combatWins: 0,
        attackBonus: 0,
        defenseBonus: 0,
        arenaBuffTurnsRemaining: 0,
        render: createGameSessionInitialRenderState(),
    }));

    return {
        mapId: map.id,
        mapName: map.name,
        mode: map.mode,
        mapSize: map.mapsize,
        debugMode: false,
        map: map.map.map((cell) => ({ ...cell, position: { ...cell.position } })),
        objects: buildVisibleObjects(map.objects, initializedPlayers, null),
        allObjects: map.objects.map((object) => ({ ...object, position: { ...object.position } })),
        allStartingPoints: availableStartObjects.map((object) => ({ ...object.position })),
        players: initializedPlayers,
        flagCarrierId: null,
        pendingFlagTransfer: null,
        sanctuaryStates: buildGameSessionSanctuaryStates(map.objects),
        pendingSanctuaryChoice: null,
        endState: null,
    };
}

export function getGameSessionDestination(position: Vec2, direction: 'up' | 'down' | 'left' | 'right'): Vec2 {
    const offsets = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    };
    const offset = offsets[direction];
    return { x: position.x + offset.x, y: position.y + offset.y };
}

export function createGameSessionInitialRenderState(): PlayerRenderState {
    return {
        facing: PlayerFacing.Front,
        pose: PlayerPose.Idle,
    };
}

export function getGameSessionFacingToTarget(from: Vec2, to: Vec2): PlayerFacing | null {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    if (deltaX === 0 && deltaY === 0) {
        return null;
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        return deltaX >= 0 ? PlayerFacing.Right : PlayerFacing.Left;
    }

    return deltaY >= 0 ? PlayerFacing.Front : PlayerFacing.Back;
}

export function getGameSessionMovementCost(match: InitializedMatch, destination: Vec2, movingPlayerId: string): number | null {
    const cell = match.map.find((candidate) => samePosition(candidate.position, destination));
    if (!cell) return null;
    if (cell.tileType === TileType.WALL) return null;
    if (cell.tileType === TileType.DOOR && !cell.isWalkable) return null;

    const blockingObject = getGameSessionObjectCovering(match.objects, destination);
    if (blockingObject && (blockingObject.type === ObjectType.REGEN || blockingObject.type === ObjectType.ARENA)) {
        return null;
    }

    if (match.players.some((player) => player.id !== movingPlayerId && samePosition(player.position, destination))) {
        return null;
    }

    if (cell.tileType === TileType.ICE) return 0;
    if (cell.tileType === TileType.WATER) return 2;
    return 1;
}

export function buildGameSessionVisibleObjects(
    objects: InitializedMatch['allObjects'],
    players: MatchPlayer[],
): MapObject[] {
    const activeStarts = new Set(players.map((player) => `${player.startingPosition.x}:${player.startingPosition.y}`));
    return objects
        .filter((object) => object.type !== ObjectType.START || activeStarts.has(`${object.position.x}:${object.position.y}`))
        .map((object) => ({ ...object, position: { ...object.position } }));
}

export function buildGameSessionSanctuaryStates(objects: MapObject[]): MatchSanctuaryState[] {
    return objects
        .filter((object) => isGameSessionSanctuaryObject(object))
        .map((object) => ({ objectId: object.id, cooldownTurnsRemaining: 0 }));
}

export function isGameSessionSanctuaryObject(object: MapObject): boolean {
    return object.type === ObjectType.REGEN || object.type === ObjectType.ARENA;
}

export function isGameSessionSanctuaryActive(match: InitializedMatch, objectId: number): boolean {
    return (match.sanctuaryStates?.find((state) => state.objectId === objectId)?.cooldownTurnsRemaining ?? 0) === 0;
}
export function getGameSessionObjectCovering(objects: MapObject[], position: Vec2): MapObject | null {
    return objects.find((object) => getGameSessionObjectFootprint(object).some((tile) => samePosition(tile, position))) ?? null;
}

export function shuffle<T>(values: readonly T[], random: () => number): T[] {
    const next = [...values];
    for (let index = next.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(random() * (index + 1));
        [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }
    return next;
}

function samePosition(left: Vec2, right: Vec2): boolean {
    return left.x === right.x && left.y === right.y;
}

export function getGameSessionObjectFootprint(object: MapObject): Vec2[] {
    if (object.size !== ObjectSize.L) {
        return [{ ...object.position }];
    }

    return [
        { x: object.position.x, y: object.position.y },
        { x: object.position.x + 1, y: object.position.y },
        { x: object.position.x, y: object.position.y + 1 },
        { x: object.position.x + 1, y: object.position.y + 1 },
    ];
}

export function isPlayerOnIce(match: InitializedMatch, playerId: string): boolean {
    const position = match.players.find((player) => player.id === playerId)?.position;
    if(!position)
        return false;
    const cell = match.map.find((candidate) => samePosition(candidate.position, position));
    if(!cell)
        return false;
    return (cell.tileType === TileType.ICE);
}

