/* eslint-disable max-lines */
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { Vec2 } from '@common/maps/map.interface';
import {
    getGameSessionDestination,
    getGameSessionMovementCost,
    getGameSessionObjectFootprint,
    isGameSessionSanctuaryActive,
    isGameSessionSanctuaryObject,
} from './game-session.match';

export type MovementDirection = 'up' | 'down' | 'left' | 'right';

export type VirtualPlayerDecision =
    | { kind: 'move'; direction: MovementDirection }
    | { kind: 'combat'; targetId: string }
    | { kind: 'toggle-door'; position: Vec2 }
    | { kind: 'use-sanctuary'; sanctuaryId: number }
    | { kind: 'end-turn' };

interface MoveCandidate {
    cost: number;
    direction: MovementDirection;
    remainingPathLength: number;
}

interface TraversalNode {
    cost: number;
    position: Vec2;
}

interface PathNode {
    cost: number;
    previous: string | null;
    position: Vec2;
}

interface PathOptions {
    startPosition?: Vec2;
    stopAdjacent?: boolean;
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

interface StrategicTarget {
    options?: PathOptions;
    position: Vec2;
}

const DIRECTIONS: MovementDirection[] = ['up', 'down', 'left', 'right'];

export function planVirtualPlayerDecision(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
): VirtualPlayerDecision {
    const adjacentEnemy = findAdjacentEnemy(match, player);
    if (player.virtualProfile === 'defensive') {
        return planDefensiveDecision(match, turnState, player, adjacentEnemy);
    }
    return planAggressiveDecision(match, turnState, player, adjacentEnemy);
}

function planAggressiveDecision(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
    adjacentEnemy: MatchPlayer | null,
): VirtualPlayerDecision {
    if (!turnState.actionTaken && adjacentEnemy) {
        return { kind: 'combat', targetId: adjacentEnemy.id };
    }
    const sanctuaryAction = buildSanctuaryAction(match, turnState, player);
    if (sanctuaryAction) {
        return sanctuaryAction;
    }
    const ctfMove = buildCtfMovement(match, turnState, player);
    if (ctfMove) {
        return ctfMove;
    }
    const chaseMove = buildMoveTowardClosestEnemy(match, turnState, player);
    if (chaseMove) {
        return chaseMove;
    }
    const doorMove = buildMoveTowardBlockedDoor(match, turnState, player, getAggressiveTargets(match, player));
    if (doorMove) {
        return doorMove;
    }
    const doorAction = buildDoorAction(match, turnState, player, getAggressiveTargets(match, player));
    if (doorAction) {
        return doorAction;
    }
    return { kind: 'end-turn' };
}

function planDefensiveDecision(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
    adjacentEnemy: MatchPlayer | null,
): VirtualPlayerDecision {
    const ctfMove = buildCtfMovement(match, turnState, player);
    if (ctfMove) {
        return ctfMove;
    }
    const sanctuaryAction = buildSanctuaryAction(match, turnState, player);
    if (sanctuaryAction) {
        return sanctuaryAction;
    }
    const retreatMove = buildRetreatMove(match, turnState, player);
    if (retreatMove) {
        return retreatMove;
    }
    if (!turnState.actionTaken && adjacentEnemy) {
        return { kind: 'combat', targetId: adjacentEnemy.id };
    }
    const doorMove = buildMoveTowardBlockedDoor(match, turnState, player, getDefensiveTargets(match, player));
    if (doorMove) {
        return doorMove;
    }
    const doorAction = buildDoorAction(match, turnState, player, getDefensiveTargets(match, player));
    if (doorAction) {
        return doorAction;
    }
    return { kind: 'end-turn' };
}

function buildSanctuaryAction(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
): VirtualPlayerDecision | null {
    if (turnState.actionTaken) {
        return null;
    }

    const sanctuary = match.allObjects
        .filter((object) => isGameSessionSanctuaryObject(object) && isGameSessionSanctuaryActive(match, object.id))
        .filter((object) => object.type === ObjectType.REGEN
            ? player.health < player.maxHealth
            : (player.arenaBuffTurnsRemaining ?? 0) === 0)
        .find((object) => getGameSessionObjectFootprint(object).some((tile) => areAdjacent(player.position, tile)));

    return sanctuary ? { kind: 'use-sanctuary', sanctuaryId: sanctuary.id } : null;
}

function buildCtfMovement(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
): VirtualPlayerDecision | null {
    if (match.mode !== GameMode.CTF || turnState.movementPointsRemaining <= 0) {
        return null;
    }

    if (match.flagCarrierId === player.id) {
        return buildMoveTowardTarget(match, player, player.startingPosition, turnState.movementPointsRemaining);
    }

    const flagCarrier = match.flagCarrierId
        ? match.players.find((candidate) => candidate.id === match.flagCarrierId) ?? null
        : null;

    if (flagCarrier && !isSameTeam(player, flagCarrier)) {
        if (player.virtualProfile === 'defensive') {
            const blockingTarget = findNearestEnterableTile(match, player.id, flagCarrier.startingPosition);
            return buildMoveTowardTarget(match, player, blockingTarget ?? flagCarrier.startingPosition, turnState.movementPointsRemaining);
        }

        return buildMoveTowardTarget(match, player, flagCarrier.position, turnState.movementPointsRemaining, { stopAdjacent: true });
    }

    if (!match.flagCarrierId) {
        const flag = match.allObjects.find((object) => object.type === ObjectType.FLAG) ?? null;
        if (flag) {
            return buildMoveTowardTarget(match, player, flag.position, turnState.movementPointsRemaining);
        }
    }

    return null;
}

function buildMoveTowardClosestEnemy(match: InitializedMatch, turnState: MatchTurnState, player: MatchPlayer): VirtualPlayerDecision | null {
    const enemies = getPrioritizedEnemies(match, player);
    const paths = enemies
        .map((enemy) => ({
            enemy,
            candidate: getBestAffordableMoveTowardTarget(match, player, enemy.position, turnState.movementPointsRemaining, { stopAdjacent: true }),
        }))
        .filter((candidate): candidate is { enemy: MatchPlayer; candidate: MoveCandidate } => candidate.candidate !== null)
        .sort((left, right) => left.candidate.remainingPathLength - right.candidate.remainingPathLength);

    return paths[0] ? { kind: 'move', direction: paths[0].candidate.direction } : null;
}

function buildDoorAction(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
    targets: StrategicTarget[],
): VirtualPlayerDecision | null {
    if (turnState.actionTaken) {
        return null;
    }

    const candidates = getAdjacentClosedDoors(match, player.position)
        .map((doorPosition) => buildDoorCandidate(match, player, doorPosition, targets))
        .filter((candidate): candidate is { pathLength: number; position: Vec2 } => candidate !== null)
        .sort((left, right) => {
            if (left.pathLength !== right.pathLength) {
                return left.pathLength - right.pathLength;
            }
            if (left.position.y !== right.position.y) {
                return left.position.y - right.position.y;
            }
            return left.position.x - right.position.x;
        });

    return candidates[0] ? { kind: 'toggle-door', position: candidates[0].position } : null;
}

function buildMoveTowardBlockedDoor(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
    targets: StrategicTarget[],
): VirtualPlayerDecision | null {
    if (turnState.movementPointsRemaining <= 0) {
        return null;
    }

    const candidates = getClosedDoors(match)
        .flatMap((doorPosition) =>
            targets.map((target) => {
                const openDoorPath = findPath(buildMatchWithOpenDoor(match, doorPosition), player.id, target.position, target.options);
                if (openDoorPath.length === 0 || !openDoorPath.some((step) => samePosition(step, doorPosition))) {
                    return null;
                }

                const nextStep = openDoorPath[0];
                if (!nextStep || samePosition(nextStep, doorPosition)) {
                    return null;
                }

                const move = buildMoveDecision(player.position, nextStep);
                if (!move || move.kind !== 'move') {
                    return null;
                }

                const stepCost = getGameSessionMovementCost(match, nextStep, player.id);
                if (stepCost === null || stepCost > turnState.movementPointsRemaining) {
                    return null;
                }

                return {
                    direction: move.direction,
                    doorPosition,
                    nextStep,
                    pathLength: openDoorPath.length,
                };
            }),
        )
        .filter((candidate): candidate is { direction: MovementDirection
            ; doorPosition: Vec2; nextStep: Vec2; pathLength: number } => candidate !== null)
        .sort((left, right) => {
            if (left.pathLength !== right.pathLength) {
                return left.pathLength - right.pathLength;
            }
            if (left.nextStep.y !== right.nextStep.y) {
                return left.nextStep.y - right.nextStep.y;
            }
            return left.nextStep.x - right.nextStep.x;
        });

    return candidates[0] ? { kind: 'move', direction: candidates[0].direction } : null;
}

function buildRetreatMove(
    match: InitializedMatch,
    turnState: MatchTurnState,
    player: MatchPlayer,
): VirtualPlayerDecision | null {
    if (turnState.movementPointsRemaining <= 0) {
        return null;
    }

    const enemies = getEnemies(match, player);
    if (enemies.length === 0) {
        return null;
    }

    const reachable = getReachableTiles(match, player.id, turnState.movementPointsRemaining);
    const currentDistance = getNearestEnemyDistance(player.position, enemies);
    const bestCandidate = [...reachable.values()]
        .filter((candidate) => !samePosition(candidate.position, player.position))
        .map((candidate) => ({
            ...candidate,
            nearestEnemyDistance: getNearestEnemyDistance(candidate.position, enemies),
        }))
        .filter((candidate) => candidate.nearestEnemyDistance > currentDistance)
        .sort((left, right) => {
            if (left.nearestEnemyDistance !== right.nearestEnemyDistance) {
                return right.nearestEnemyDistance - left.nearestEnemyDistance;
            }
            if (left.cost !== right.cost) {
                return left.cost - right.cost;
            }
            if (left.position.y !== right.position.y) {
                return left.position.y - right.position.y;
            }
            return left.position.x - right.position.x;
        })[0];

    if (!bestCandidate) {
        return null;
    }

    const path = reconstructPath(reachable, bestCandidate.position);
    return buildMoveDecision(player.position, path[0] ?? null);
}

function buildMoveTowardTarget(
    match: InitializedMatch,
    player: MatchPlayer,
    target: Vec2,
    movementPointsRemaining: number,
    options: PathOptions = {},
): VirtualPlayerDecision | null {
    const candidate = getBestAffordableMoveTowardTarget(match, player, target, movementPointsRemaining, options);
    return candidate ? { kind: 'move', direction: candidate.direction } : null;
}

function buildMoveDecision(from: Vec2, nextStep: Vec2 | null): VirtualPlayerDecision | null {
    if (!nextStep) {
        return null;
    }

    for (const direction of DIRECTIONS) {
        const destination = getGameSessionDestination(from, direction);
        if (samePosition(destination, nextStep)) {
            return { kind: 'move', direction };
        }
    }

    return null;
}

function findPath(
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

function getReachableTiles(
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

function buildDoorCandidate(
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

function buildMatchWithOpenDoor(match: InitializedMatch, doorPosition: Vec2): InitializedMatch {
    return {
        ...match,
        map: match.map.map((cell) =>
            samePosition(cell.position, doorPosition) ? { ...cell, isWalkable: true } : cell,
        ),
    };
}

function findNearestEnterableTile(match: InitializedMatch, playerId: string, origin: Vec2): Vec2 | null {
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

function reconstructPath(visited: Map<string, PathNode>, destination: Vec2): Vec2[] {
    const path: Vec2[] = [];
    let cursor = visited.get(positionKey(destination)) ?? null;

    while (cursor?.previous) {
        path.unshift({ ...cursor.position });
        cursor = visited.get(cursor.previous) ?? null;
    }

    return path;
}

function getBestAffordableMoveTowardTarget(
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

function hasReachedPathTarget(position: Vec2, target: Vec2, options: PathOptions): boolean {
    return options.stopAdjacent ? areAdjacent(position, target) : samePosition(position, target);
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

function findAdjacentEnemy(match: InitializedMatch, player: MatchPlayer): MatchPlayer | null {
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

function getEnemies(match: InitializedMatch, player: MatchPlayer): MatchPlayer[] {
    return match.players.filter((candidate) =>
        candidate.id !== player.id &&
        (match.mode !== GameMode.CTF || !isSameTeam(player, candidate)),
    );
}

function getPrioritizedEnemies(match: InitializedMatch, player: MatchPlayer): MatchPlayer[] {
    return getEnemies(match, player).sort((left, right) => {
        const leftPriority = match.flagCarrierId === left.id ? 0 : 1;
        const rightPriority = match.flagCarrierId === right.id ? 0 : 1;
        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
        }
        return getDistance(player.position, left.position) - getDistance(player.position, right.position);
    });
}

function getAggressiveTargets(match: InitializedMatch, player: MatchPlayer): StrategicTarget[] {
    return [
        ...getCtfTargets(match, player),
        ...getPrioritizedEnemies(match, player).map((enemy) => ({
            options: { stopAdjacent: true },
            position: enemy.position,
        })),
    ];
}

function getDefensiveTargets(match: InitializedMatch, player: MatchPlayer): StrategicTarget[] {
    return [
        ...getCtfTargets(match, player),
        ...getPrioritizedEnemies(match, player).map((enemy) => ({
            options: { stopAdjacent: true },
            position: enemy.position,
        })),
    ];
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

function getAdjacentClosedDoors(match: InitializedMatch, origin: Vec2): Vec2[] {
    return DIRECTIONS
        .map((direction) => getGameSessionDestination(origin, direction))
        .filter((position) => {
            const cell = match.map.find((candidate) => samePosition(candidate.position, position)) ?? null;
            return !!cell && cell.tileType === TileType.DOOR && !cell.isWalkable;
        });
}

function getClosedDoors(match: InitializedMatch): Vec2[] {
    return match.map
        .filter((cell) => cell.tileType === TileType.DOOR && !cell.isWalkable)
        .map((cell) => ({ ...cell.position }));
}

function getNearestEnemyDistance(position: Vec2, enemies: MatchPlayer[]): number {
    return enemies.reduce((closest, enemy) => Math.min(closest, getDistance(position, enemy.position)), Number.POSITIVE_INFINITY);
}

function isSameTeam(left: MatchPlayer, right: MatchPlayer): boolean {
    return left.teamId !== null && left.teamId !== undefined && left.teamId === right.teamId;
}

function areAdjacent(left: Vec2, right: Vec2): boolean {
    return getDistance(left, right) === 1;
}

function getDistance(left: Vec2, right: Vec2): number {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function samePosition(left: Vec2, right: Vec2): boolean {
    return left.x === right.x && left.y === right.y;
}

function positionKey(position: Vec2): string {
    return `${position.x}:${position.y}`;
}
