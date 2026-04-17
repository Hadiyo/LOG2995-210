import { MovementDirection } from '@common/game/movement-direction';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { Vec2 } from '@common/maps/map.interface';
import { getGameSessionDestination, getGameSessionMovementCost } from './game-session.match';

export type { MovementDirection } from '@common/game/movement-direction';

export interface MoveCandidate {
    cost: number;
    direction: MovementDirection;
    remainingPathLength: number;
}

export interface PathNode {
    cost: number;
    previous: string | null;
    position: Vec2;
}

export interface PathOptions {
    startPosition?: Vec2;
    stopAdjacent?: boolean;
}

export interface StrategicTarget {
    options?: PathOptions;
    position: Vec2;
}

interface TraversalNode {
    cost: number;
    position: Vec2;
}

interface NeighborVisitContext {
    currentCost: number;
    currentPosition: Vec2;
    direction: MovementDirection;
    frontier: TraversalNode[];
    previousKey: string;
    visited: Map<string, PathNode>;
}

interface AffordableMoveContext {
    direction: MovementDirection;
    movementPointsRemaining: number;
    options: PathOptions;
    player: MatchPlayer;
    target: Vec2;
}

export const DIRECTIONS: MovementDirection[] = ['up', 'down', 'left', 'right'];

export function buildDoorCandidate(
    match: InitializedMatch,
    player: MatchPlayer,
    doorPosition: Vec2,
    targets: StrategicTarget[],
): { pathLength: number; position: Vec2 } | null {
    const matchWithOpenDoor = buildMatchWithOpenDoor(match, doorPosition);
    const matchingTarget = targets
        .map((target) => ({
            path: findPath(matchWithOpenDoor, player.id, target.position, target.options),
            target,
        }))
        .find(({ path }) => path.length > 0 && samePosition(path[0], doorPosition));

    if (!matchingTarget) {
        return null;
    }

    return {
        pathLength: matchingTarget.path.length,
        position: doorPosition,
    };
}

export function findNearestEnterableTile(match: InitializedMatch, playerId: string, origin: Vec2): Vec2 | null {
    const candidates = match.map
        .filter((cell) => getGameSessionMovementCost(match, cell.position, playerId) !== null)
        .sort((left, right) => {
            const distanceDelta = getDistance(left.position, origin) - getDistance(right.position, origin);
            if (distanceDelta !== 0) {
                return distanceDelta;
            }
            if (left.position.y !== right.position.y) {
                return left.position.y - right.position.y;
            }
            return left.position.x - right.position.x;
        });

    return candidates[0] ? { ...candidates[0].position } : null;
}

export function findPath(
    match: InitializedMatch,
    playerId: string,
    target: Vec2,
    options: PathOptions = {},
): Vec2[] {
    const player = match.players.find((candidate) => candidate.id === playerId) ?? null;
    if (!player) {
        return [];
    }

    const startPosition = options.startPosition ?? player.position;
    const frontier: TraversalNode[] = [{ position: { ...startPosition }, cost: 0 }];
    const visited = new Map<string, PathNode>([
        [positionKey(startPosition), { cost: 0, position: { ...startPosition }, previous: null }],
    ]);

    while (frontier.length > 0) {
        frontier.sort((left, right) => left.cost - right.cost);
        const current = frontier.shift();
        if (!current) {
            continue;
        }

        const currentKey = positionKey(current.position);
        if (current.cost !== visited.get(currentKey)?.cost) {
            continue;
        }

        if (hasReachedPathTarget(current.position, target, options)) {
            return reconstructPath(visited, current.position);
        }

        for (const direction of DIRECTIONS) {
            visitNeighbor(match, playerId, {
                currentCost: current.cost,
                currentPosition: current.position,
                direction,
                frontier,
                previousKey: currentKey,
                visited,
            });
        }
    }

    return [];
}

export function getBestAffordableMoveTowardTarget(
    match: InitializedMatch,
    player: MatchPlayer,
    target: Vec2,
    movementPointsRemaining: number,
    options: PathOptions = {},
): MoveCandidate | null {
    const candidates = DIRECTIONS
        .map((direction) => buildAffordableMoveCandidate(match, {
            direction,
            movementPointsRemaining,
            options,
            player,
            target,
        }))
        .filter((candidate): candidate is MoveCandidate => candidate !== null)
        .sort((left, right) => {
            if (left.remainingPathLength !== right.remainingPathLength) {
                return left.remainingPathLength - right.remainingPathLength;
            }
            return left.cost - right.cost;
        });

    return candidates[0] ?? null;
}

export function getReachableTiles(
    match: InitializedMatch,
    playerId: string,
    movementPointsAvailable: number,
): Map<string, PathNode> {
    const player = match.players.find((candidate) => candidate.id === playerId) ?? null;
    if (!player) {
        return new Map();
    }

    const frontier: TraversalNode[] = [{ position: { ...player.position }, cost: 0 }];
    const visited = new Map<string, PathNode>([
        [positionKey(player.position), { cost: 0, position: { ...player.position }, previous: null }],
    ]);

    while (frontier.length > 0) {
        frontier.sort((left, right) => left.cost - right.cost);
        const current = frontier.shift();
        if (!current) {
            continue;
        }

        const currentKey = positionKey(current.position);
        if (current.cost !== visited.get(currentKey)?.cost) {
            continue;
        }

        for (const direction of DIRECTIONS) {
            const nextPosition = getGameSessionDestination(current.position, direction);
            const stepCost = getGameSessionMovementCost(match, nextPosition, playerId);
            if (stepCost === null) {
                continue;
            }

            const nextCost = current.cost + stepCost;
            if (nextCost > movementPointsAvailable) {
                continue;
            }

            const nextKey = positionKey(nextPosition);
            if (nextCost >= (visited.get(nextKey)?.cost ?? Number.POSITIVE_INFINITY)) {
                continue;
            }

            visited.set(nextKey, {
                cost: nextCost,
                position: { ...nextPosition },
                previous: currentKey,
            });
            frontier.push({ position: { ...nextPosition }, cost: nextCost });
        }
    }

    return visited;
}

export function reconstructPath(visited: Map<string, PathNode>, destination: Vec2): Vec2[] {
    const path: Vec2[] = [];
    let cursor = visited.get(positionKey(destination)) ?? null;

    while (cursor?.previous) {
        path.unshift({ ...cursor.position });
        cursor = visited.get(cursor.previous) ?? null;
    }

    return path;
}

export function samePosition(left: Vec2, right: Vec2): boolean {
    return left.x === right.x && left.y === right.y;
}

function areAdjacent(left: Vec2, right: Vec2): boolean {
    return getDistance(left, right) === 1;
}

function buildMatchWithOpenDoor(match: InitializedMatch, doorPosition: Vec2): InitializedMatch {
    return {
        ...match,
        map: match.map.map((cell) =>
            samePosition(cell.position, doorPosition) ? { ...cell, isWalkable: true } : cell,
        ),
    };
}

function buildAffordableMoveCandidate(
    match: InitializedMatch,
    context: AffordableMoveContext,
): MoveCandidate | null {
    const destination = getGameSessionDestination(context.player.position, context.direction);
    const stepCost = getGameSessionMovementCost(match, destination, context.player.id);
    if (stepCost === null || stepCost > context.movementPointsRemaining) {
        return null;
    }

    if (hasReachedPathTarget(destination, context.target, context.options)) {
        return { cost: stepCost, direction: context.direction, remainingPathLength: 0 };
    }

    const path = findPath(match, context.player.id, context.target, { ...context.options, startPosition: destination });
    if (path.length === 0) {
        return null;
    }

    return {
        cost: stepCost,
        direction: context.direction,
        remainingPathLength: path.length,
    };
}

function getDistance(left: Vec2, right: Vec2): number {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function hasReachedPathTarget(position: Vec2, target: Vec2, options: PathOptions): boolean {
    return options.stopAdjacent ? areAdjacent(position, target) : samePosition(position, target);
}

function positionKey(position: Vec2): string {
    return `${position.x}:${position.y}`;
}

function visitNeighbor(
    match: InitializedMatch,
    playerId: string,
    context: NeighborVisitContext,
): void {
    const nextPosition = getGameSessionDestination(context.currentPosition, context.direction);
    const stepCost = getGameSessionMovementCost(match, nextPosition, playerId);
    if (stepCost === null) {
        return;
    }

    const nextCost = context.currentCost + stepCost;
    const nextKey = positionKey(nextPosition);
    if (nextCost >= (context.visited.get(nextKey)?.cost ?? Number.POSITIVE_INFINITY)) {
        return;
    }

    context.visited.set(nextKey, {
        cost: nextCost,
        position: { ...nextPosition },
        previous: context.previousKey,
    });
    context.frontier.push({ position: { ...nextPosition }, cost: nextCost });
}
