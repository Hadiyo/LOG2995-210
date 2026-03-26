import { InitializedMatch, MatchLobbyPlayer, MatchPlayer, MatchTeamId } from '@common/game/match.interface';
import { EditorMapDetails, MapObject, Vec2 } from '@common/maps/map.interface';
import { GameMode, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { PlayerFacing, PlayerRenderState } from '@common/player/player.interface';

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
        render: createGameSessionInitialRenderState(),
    }));

    return {
        mapId: map.id,
        mapName: map.name,
        mode: map.mode,
        mapSize: map.mapsize,
        debugMode: false,
        map: map.map.map((cell) => ({ ...cell, position: { ...cell.position } })),
        objects: buildGameSessionVisibleObjects(map.objects, initializedPlayers, null),
        allObjects: map.objects.map((object) => ({ ...object, position: { ...object.position } })),
        allStartingPoints: availableStartObjects.map((object) => ({ ...object.position })),
        players: initializedPlayers,
        flagCarrierId: null,
        pendingFlagTransfer: null,
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

export function getGameSessionMovementCost(match: InitializedMatch, destination: Vec2, movingPlayerId: string): number | null {
    const cell = match.map.find((candidate) => samePosition(candidate.position, destination));
    if (!cell) return null;
    if (cell.tileType === TileType.WALL) return null;
    if (cell.tileType === TileType.DOOR && !cell.isWalkable) return null;
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
    flagCarrierId: string | null,
): MapObject[] {
    const activeStarts = new Set(players.map((player) => `${player.startingPosition.x}:${player.startingPosition.y}`));
    return objects
        .filter((object) => {
            if (object.type === ObjectType.START) {
                return activeStarts.has(`${object.position.x}:${object.position.y}`);
            }

            if (object.type === ObjectType.FLAG) {
                return flagCarrierId === null;
            }

            return true;
        })
        .map((object) => ({ ...object, position: { ...object.position } }));
}

export function resolveGameSessionFlagCarrier(match: InitializedMatch, playerId: string, position: Vec2): string | null {
    if (match.flagCarrierId) {
        return match.flagCarrierId;
    }

    if (match.mode !== GameMode.CTF) {
        return null;
    }

    const flagObject = match.allObjects.find((object) => object.type === ObjectType.FLAG);
    if (!flagObject) {
        return null;
    }

    return samePosition(flagObject.position, position) ? playerId : null;
}

export function createGameSessionInitialRenderState(): PlayerRenderState {
    return {
        facing: 'front',
        pose: 'idle',
    };
}

export function getGameSessionFacingToTarget(from: Vec2, to: Vec2): PlayerFacing | null {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    if (deltaX === 0 && deltaY === 0) {
        return null;
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        return deltaX >= 0 ? 'right' : 'left';
    }

    return deltaY >= 0 ? 'front' : 'back';
}

export function getGameSessionObjectCovering(objects: MapObject[], position: Vec2): MapObject | null {
    return objects.find((object) => objectFootprint(object).some((tile) => samePosition(tile, position))) ?? null;
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

function objectFootprint(object: MapObject): Vec2[] {
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

function buildTeamAssignments(playerCount: number, mode: GameMode, random: () => number): (MatchTeamId | null)[] {
    if (mode !== GameMode.CTF || playerCount < 2 || playerCount % 2 !== 0) {
        return Array.from({ length: playerCount }, () => null);
    }

    const assignments: (MatchTeamId | null)[] = Array.from({ length: playerCount }, () => null);
    const shuffledIndexes = shuffle(Array.from({ length: playerCount }, (_, index) => index), random);
    const playersPerTeam = playerCount / 2;

    shuffledIndexes.forEach((playerIndex, orderIndex) => {
        assignments[playerIndex] = orderIndex < playersPerTeam ? 'A' : 'B';
    });

    return assignments;
}
