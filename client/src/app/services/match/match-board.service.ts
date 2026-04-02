import { Injectable } from '@angular/core';
import {
    InitializedMatch,
    MatchPlayer,
    MatchSanctuaryState,
    MatchTileInspection,
} from '@common/game/match.interface';
import { buildVisibleObjects as buildMatchVisibleObjects } from '@common/game/match.utils';
import { ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, MapObject, Vec2 } from '@common/maps/map.interface';
import { cloneVec2, manhattanDistance, positionKey, samePosition } from './match-geometry';

const TILE_LABELS: Record<TileType, string> = {
    [TileType.DIRT]: 'Tuile de base',
    [TileType.WATER]: "Tuile d'eau",
    [TileType.ICE]: 'Tuile de glace',
    [TileType.WALL]: 'Mur',
    [TileType.DOOR]: 'Porte',
};

const TILE_CHARACTERISTICS: Record<TileType, string[]> = {
    [TileType.DIRT]: ['Accessible', 'Cout de mouvement: 1'],
    [TileType.WATER]: ['Accessible', 'Cout de mouvement: 2'],
    [TileType.ICE]: ['Accessible', 'Cout de mouvement: 0'],
    [TileType.WALL]: ['Bloquee', 'Impassable'],
    [TileType.DOOR]: ['Cout de mouvement: 1'],
};

const OBJECT_DESCRIPTIONS: Record<ObjectType, string> = {
    [ObjectType.START]: "Point de depart assigné aleatoirement au debut d'une partie.",
    [ObjectType.FLAG]: "L'objectif principal du mode CTF. Pour gagner, un joueur doit revenir sur son point de depart avec le drapeau.",
    [ObjectType.REGEN]: 'Activer pour regagner 2 points de vie au joueur sans depasser le maximum.',
    [ObjectType.ARENA]: 'Activer pour obtenir un bonus temporaire de +1 en attaque et +1 en defense.',
};

const SINGLE_TILE_OFFSETS: Vec2[] = [{ x: 0, y: 0 }];
const DOUBLE_TILE_OFFSETS: Vec2[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
];

export interface CombatAftermathResult {
    players: MatchPlayer[];
    respawnedPlayers: { playerId: string; position: Vec2 }[];
    flagDroppedAt: Vec2 | null;
}

@Injectable({ providedIn: 'root' })
export class MatchBoardService {
    buildVisibleObjects(objects: MapObject[], players: MatchPlayer[], flagCarrierId: string | null): MapObject[] {
        return buildMatchVisibleObjects(objects, players, flagCarrierId);
    }

    getPlayerAt(match: InitializedMatch, position: Vec2): MatchPlayer | null {
        return match.players.find((player) => samePosition(player.position, position)) ?? null;
    }

    getObjectCovering(objects: MapObject[], position: Vec2): MapObject | null {
        return objects.find((object) => this.objectFootprint(object).some((tile) => samePosition(tile, position))) ?? null;
    }

    buildSanctuaryStates(objects: MapObject[]): MatchSanctuaryState[] {
        return objects
            .filter((object) => this.isSanctuaryObject(object))
            .map((object) => ({ objectId: object.id, cooldownTurnsRemaining: 0 }));
    }

    isSanctuaryObject(object: MapObject): boolean {
        return object.type === ObjectType.REGEN || object.type === ObjectType.ARENA;
    }

    isSanctuaryActive(match: InitializedMatch, objectId: number): boolean {
        return (match.sanctuaryStates?.find((state) => state.objectId === objectId)?.cooldownTurnsRemaining ?? 0) === 0;
    }

    inspectTile(match: InitializedMatch, position: Vec2): MatchTileInspection | null {
        const cell = match.map.find((candidate) => samePosition(candidate.position, position));
        if (!cell) {
            return null;
        }

        const object = this.getObjectCovering(match.objects, position);
        const player = this.getPlayerAt(match, position);

        return {
            position: cloneVec2(position),
            tileType: cell.tileType,
            tileLabel: TILE_LABELS[cell.tileType],
            characteristics: this.describeTile(cell),
            object: object ? {
                type: object.type,
                size: object.size,
                description: OBJECT_DESCRIPTIONS[object.type],
            } : null,
            player: player ? {
                id: player.id,
                name: player.name,
                avatarId: player.avatarId,
                teamId: player.teamId ?? null,
            } : null,
        };
    }

    applyCombatAftermath(match: InitializedMatch, defeatedPlayerIds: string[]): {
        nextMatch: InitializedMatch;
        outcome: CombatAftermathResult;
    } | null {
        if (defeatedPlayerIds.length === 0) {
            return null;
        }

        const defeatedPlayerIdsSet = new Set(defeatedPlayerIds);
        const defeatedPlayers = match.players.filter((player) => defeatedPlayerIdsSet.has(player.id));
        if (defeatedPlayers.length === 0) {
            return null;
        }

        const reservedPositions = new Set(
            match.players
                .filter((player) => !defeatedPlayerIdsSet.has(player.id))
                .map((player) => positionKey(player.position)),
        );
        let nextFlagCarrierId = match.flagCarrierId ?? null;
        let nextAllObjects = match.allObjects.map((object) => ({
            ...object,
            position: cloneVec2(object.position),
        }));
        const respawnedPlayers: { playerId: string; position: Vec2 }[] = [];
        let flagDroppedAt: Vec2 | null = null;

        const nextPlayers = match.players.map((player) => {
            if (!defeatedPlayerIdsSet.has(player.id)) {
                return player;
            }

            const respawnPosition = this.findRespawnPosition(match, player.startingPosition, reservedPositions);
            reservedPositions.add(positionKey(respawnPosition));
            respawnedPlayers.push({ playerId: player.id, position: cloneVec2(respawnPosition) });

            if (nextFlagCarrierId === player.id) {
                nextFlagCarrierId = null;
                const dropPosition = this.findNearestFreeTerrainTile(match, player.position, reservedPositions) ?? cloneVec2(player.position);
                flagDroppedAt = cloneVec2(dropPosition);
                nextAllObjects = nextAllObjects.map((object) =>
                    object.type === ObjectType.FLAG
                        ? { ...object, position: cloneVec2(dropPosition) }
                        : object,
                );
            }

            return {
                ...player,
                position: cloneVec2(respawnPosition),
                health: player.maxHealth,
            };
        });

        const nextMatch = {
            ...match,
            players: nextPlayers,
            allObjects: nextAllObjects,
            flagCarrierId: nextFlagCarrierId,
            objects: this.buildVisibleObjects(nextAllObjects, nextPlayers, nextFlagCarrierId),
        };

        return {
            nextMatch,
            outcome: {
                players: nextPlayers,
                respawnedPlayers,
                flagDroppedAt,
            },
        };
    }

    objectFootprint(object: MapObject): Vec2[] {
        const offsets = object.size === ObjectSize.L ? DOUBLE_TILE_OFFSETS : SINGLE_TILE_OFFSETS;
        return offsets.map((offset) => ({
            x: object.position.x + offset.x,
            y: object.position.y + offset.y,
        }));
    }

    areAdjacent(left: Vec2, right: Vec2): boolean {
        return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
    }

    isSameTeam(left: MatchPlayer, right: MatchPlayer): boolean {
        return left.teamId !== null && left.teamId !== undefined && left.teamId === right.teamId;
    }

    private describeTile(cell: EditorCell): string[] {
        if (cell.tileType !== TileType.DOOR) {
            return TILE_CHARACTERISTICS[cell.tileType];
        }

        return [
            cell.isWalkable ? 'Porte ouverte' : 'Porte fermee',
            ...(cell.isWalkable ? ['Accessible', 'Cout de mouvement: 1'] : ['Bloquee', 'Impassable']),
        ];
    }

    private findRespawnPosition(match: InitializedMatch, startingPosition: Vec2, reservedPositions: Set<string>): Vec2 {
        if (this.isFreeTerrainTile(match, startingPosition, reservedPositions)) {
            return cloneVec2(startingPosition);
        }

        return this.findNearestFreeTerrainTile(match, startingPosition, reservedPositions) ?? cloneVec2(startingPosition);
    }

    private findNearestFreeTerrainTile(match: InitializedMatch, origin: Vec2, reservedPositions: Set<string>): Vec2 | null {
        const candidates = match.map
            .filter((cell) => this.isFreeTerrainTile(match, cell.position, reservedPositions))
            .sort((left, right) => {
                const distanceDelta = manhattanDistance(left.position, origin) - manhattanDistance(right.position, origin);
                if (distanceDelta !== 0) {
                    return distanceDelta;
                }

                if (left.position.y !== right.position.y) {
                    return left.position.y - right.position.y;
                }

                return left.position.x - right.position.x;
            });

        return candidates[0] ? cloneVec2(candidates[0].position) : null;
    }

    private isFreeTerrainTile(match: InitializedMatch, position: Vec2, reservedPositions: Set<string>): boolean {
        const cell = match.map.find((candidate) => samePosition(candidate.position, position));
        if (!cell || cell.tileType === TileType.WALL || cell.tileType === TileType.DOOR) {
            return false;
        }

        if (reservedPositions.has(positionKey(position))) {
            return false;
        }

        return !match.allObjects.some((object) =>
            object.type !== ObjectType.START &&
            this.objectFootprint(object).some((covered) => samePosition(covered, position)),
        );
    }
}
