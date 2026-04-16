import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType } from '@common/maps/map.enums';
import { Vec2 } from '@common/maps/map.interface';
import {
    DIRECTIONS,
    MovementDirection,
    MoveCandidate,
    PathOptions,
    StrategicTarget,
    buildDoorCandidate,
    findNearestEnterableTile,
    getBestAffordableMoveTowardTarget,
    getReachableTiles,
    reconstructPath,
    samePosition,
} from './game-session.virtual-player.pathfinding';
import {
    areAdjacent,
    findAdjacentEnemy,
    getAdjacentClosedDoors,
    getAggressiveTargets,
    getDefensiveTargets,
    getEnemies,
    getNearestEnemyDistance,
    getPrioritizedEnemies,
    isSameTeam,
} from './game-session.virtual-player.strategy';
import {
    getGameSessionDestination,
    getGameSessionObjectFootprint,
    isGameSessionSanctuaryActive,
    isGameSessionSanctuaryObject,
} from './game-session.match';

export type VirtualPlayerDecision =
    | { kind: 'move'; direction: MovementDirection }
    | { kind: 'combat'; targetId: string }
    | { kind: 'toggle-door'; position: Vec2 }
    | { kind: 'use-sanctuary'; sanctuaryId: number }
    | { kind: 'end-turn' };

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
