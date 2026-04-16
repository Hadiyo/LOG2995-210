import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { Vec2 } from '@common/maps/map.interface';
import { StrategicTarget, findNearestEnterableTile } from './game-session.virtual-player.pathfinding';
import { getGameSessionDestination } from './game-session.match';

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

export function areAdjacent(left: Vec2, right: Vec2): boolean {
    return getDistance(left, right) === 1;
}

export function findAdjacentEnemy(match: InitializedMatch, player: MatchPlayer): MatchPlayer | null {
    const enemies = getEnemies(match, player)
        .filter((enemy) => areAdjacent(player.position, enemy.position))
        .sort((left, right) => {
            const leftPriority = match.flagCarrierId === left.id ? 0 : 1;
            const rightPriority = match.flagCarrierId === right.id ? 0 : 1;
            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }
            return left.name.localeCompare(right.name);
        });

    return enemies[0] ?? null;
}

export function getAdjacentClosedDoors(match: InitializedMatch, origin: Vec2): Vec2[] {
    return DIRECTIONS
        .map((direction) => getGameSessionDestination(origin, direction))
        .filter((position) => {
            const cell = match.map.find((candidate) => samePosition(candidate.position, position)) ?? null;
            return !!cell && cell.tileType === TileType.DOOR && !cell.isWalkable;
        });
}

export function getAggressiveTargets(match: InitializedMatch, player: MatchPlayer): StrategicTarget[] {
    return [
        ...getCtfTargets(match, player),
        ...getPrioritizedEnemies(match, player).map((enemy) => ({
            options: { stopAdjacent: true },
            position: enemy.position,
        })),
    ];
}

export function getDefensiveTargets(match: InitializedMatch, player: MatchPlayer): StrategicTarget[] {
    return [
        ...getCtfTargets(match, player),
        ...getPrioritizedEnemies(match, player).map((enemy) => ({
            options: { stopAdjacent: true },
            position: enemy.position,
        })),
    ];
}

export function getEnemies(match: InitializedMatch, player: MatchPlayer): MatchPlayer[] {
    return match.players.filter((candidate) =>
        candidate.id !== player.id &&
        (match.mode !== GameMode.CTF || !isSameTeam(player, candidate)),
    );
}

export function getNearestEnemyDistance(position: Vec2, enemies: MatchPlayer[]): number {
    return enemies.reduce((closest, enemy) => Math.min(closest, getDistance(position, enemy.position)), Number.POSITIVE_INFINITY);
}

export function getPrioritizedEnemies(match: InitializedMatch, player: MatchPlayer): MatchPlayer[] {
    return getEnemies(match, player).sort((left, right) => {
        const leftPriority = match.flagCarrierId === left.id ? 0 : 1;
        const rightPriority = match.flagCarrierId === right.id ? 0 : 1;
        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
        }
        return getDistance(player.position, left.position) - getDistance(player.position, right.position);
    });
}

export function isSameTeam(left: MatchPlayer, right: MatchPlayer): boolean {
    return left.teamId != null && left.teamId === right.teamId;
}

function getCtfTargets(match: InitializedMatch, player: MatchPlayer): StrategicTarget[] {
    if (match.mode !== GameMode.CTF) {
        return [];
    }

    if (match.flagCarrierId === player.id) {
        return [{ position: player.startingPosition }];
    }

    const flagCarrier = match.flagCarrierId
        ? match.players.find((candidate) => candidate.id === match.flagCarrierId) ?? null
        : null;

    if (flagCarrier && !isSameTeam(player, flagCarrier)) {
        if (player.virtualProfile === 'defensive') {
            const blockingTarget = findNearestEnterableTile(match, player.id, flagCarrier.startingPosition);
            return [{ position: blockingTarget ?? flagCarrier.startingPosition }];
        }

        return [{ options: { stopAdjacent: true }, position: flagCarrier.position }];
    }

    if (!match.flagCarrierId) {
        const flag = match.allObjects.find((object) => object.type === ObjectType.FLAG) ?? null;
        if (flag) {
            return [{ position: flag.position }];
        }
    }

    return [];
}

function getDistance(left: Vec2, right: Vec2): number {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function samePosition(left: Vec2, right: Vec2): boolean {
    return left.x === right.x && left.y === right.y;
}
