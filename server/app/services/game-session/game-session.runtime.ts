import { buildTurnOrderFromPlayers } from '@app/services/game-session/game-session.turn';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnOrderEntry, MatchTurnState } from '@common/game/turn.interface';
import { ObjectType, TileType } from '@common/maps/map.enums';
import { EditorMapDetails, Vec2 } from '@common/maps/map.interface';
import { buildInitializedMatchFromEditor, getGameSessionObjectCovering } from './game-session.match';
import { TRANSITION_DURATION_MS } from '@app/utilities/game/game.constants';
import { GameSessionRuntime } from '@app/utilities/game/game.interface';

export function buildSession(map: EditorMapDetails, players: MatchLobbyPlayer[], messages: ChatMessage[] = []): GameSessionRuntime {
    const sessionId = crypto.randomUUID();
    const match = buildInitializedMatchFromEditor(map, players, Math.random);
    const order = buildTurnOrderFromPlayers(match.players, Math.random);
    const firstPlayerId = order[0]?.playerId ?? null;
    const turnState = initTurnState(match.mapId,firstPlayerId, TRANSITION_DURATION_MS, order);

    return {
        sessionId,
        match,
        turnState,
        messages: messages.map((message) => ({ ...message })),
        socketToPlayerId: new Map(),
        transitionTimeoutId: null,
        activeTurnTimeoutId: null,
        timerIntervalId: null,
        virtualDecisionTimeoutId: null,
    };
}

export function createTransitionTurnState(current: MatchTurnState): MatchTurnState {
    return {
        ...current,
        phase: 'transition',
        hasStarted: current.hasStarted,
        activePlayerId: null,
        transitionTargetPlayerId: current.order[current.currentTurnIndex]?.playerId ?? null,
        transitionEndsAt: Date.now() + TRANSITION_DURATION_MS,
        transitionRemainingMs: TRANSITION_DURATION_MS,
        activeTurnEndsAt: null,
        activeTurnRemainingMs: 0,
        movementPointsRemaining: 0,
        actionTaken: false,
        movementCount: 0,
        playerStates: current.order.map((entry) => ({ playerId: entry.playerId, state: 'waiting' })),
    };
}

export function createActiveTurnState(current: MatchTurnState, activePlayer: MatchPlayer, duration: number): MatchTurnState {
    const activePlayerId = current.order[current.currentTurnIndex]?.playerId ?? null;
    return {
        ...current,
        hasStarted: true,
        phase: 'active',
        activePlayerId,
        transitionTargetPlayerId: null,
        transitionEndsAt: null,
        transitionRemainingMs: 0,
        activeTurnEndsAt: Date.now() + duration,
        activeTurnRemainingMs: duration,
        movementPointsRemaining: activePlayer.speed,
        actionTaken: false,
        movementCount: 0,
        playerStates: current.order.map((entry) => ({
            playerId: entry.playerId,
            state: entry.playerId === activePlayerId ? 'active' : 'waiting',
        })),
    };
}

export function initTurnState(id: string, firstPlayerId: string, duration: number, order: MatchTurnOrderEntry[]): MatchTurnState {
    return {
        matchId: id,
        hasStarted: false,
        order,
        currentTurnIndex: 0,
        phase: 'transition',
        activePlayerId: null,
        transitionTargetPlayerId: firstPlayerId,
        transitionEndsAt: Date.now() + duration,
        transitionRemainingMs: duration,
        activeTurnEndsAt: null,
        activeTurnRemainingMs: 0,
        movementPointsRemaining: 0,
        actionTaken: false,
        movementCount: 0,
        playerStates: order.map((entry) => ({ playerId: entry.playerId, state: 'waiting' })),
    };
}


export function canStartCombat(attacker: MatchPlayer, defender: MatchPlayer): boolean {
    return Math.abs(attacker.position.x - defender.position.x) + Math.abs(attacker.position.y - defender.position.y) === 1;
}

export function resolveRespawnPosition(match: InitializedMatch, defeatedPlayerId: string): Vec2 {
    const defeatedPlayer = match.players.find((player) => player.id === defeatedPlayerId);
    if (!defeatedPlayer) {
        return { x: 0, y: 0 };
    }

    const occupiedKeys = new Set(
        match.players
            .filter((player) => player.id !== defeatedPlayerId)
            .map((player) => `${player.position.x}:${player.position.y}`),
    );

    const origin = defeatedPlayer.startingPosition;
    const isFree = (pos: Vec2): boolean => {
        if (occupiedKeys.has(`${pos.x}:${pos.y}`)) {
            return false;
        }

        const blockingObject = getGameSessionObjectCovering(match.allObjects, pos);
        return !blockingObject || (blockingObject.type !== ObjectType.REGEN && blockingObject.type !== ObjectType.ARENA);
    };

    if (isFree(origin)) {
        return { ...origin };
    }

    const candidates = match.map
        .filter((cell) => cell.tileType !== TileType.WALL && cell.tileType !== TileType.DOOR && isFree(cell.position))
        .sort((left, right) => {
            const distanceDelta =
                (Math.abs(left.position.x - origin.x) + Math.abs(left.position.y - origin.y)) -
                (Math.abs(right.position.x - origin.x) + Math.abs(right.position.y - origin.y));
            if (distanceDelta !== 0) return distanceDelta;
            if (left.position.y !== right.position.y) return left.position.y - right.position.y;
            return left.position.x - right.position.x;
        });

    return candidates[0] ? { ...candidates[0].position } : { ...origin };
}

export function rebuildTurnStateAfterRosterChange(current: MatchTurnState, players: MatchPlayer[]): MatchTurnState {
    const playerIds = new Set(players.map((player) => player.id));
    const order = current.order.filter((entry) => playerIds.has(entry.playerId));
    const removedBeforeCurrent = current.order
        .slice(0, current.currentTurnIndex)
        .filter((entry) => !playerIds.has(entry.playerId)).length;
    const currentTurnIndex = order.length === 0 ? 0 : (current.currentTurnIndex - removedBeforeCurrent) % order.length;
    const activePlayerId = order[currentTurnIndex]?.playerId ?? null;
    return {
        ...current,
        order,
        currentTurnIndex,
        activePlayerId,
        transitionTargetPlayerId: current.phase === 'transition' ? activePlayerId : null,
        playerStates: order.map((entry) => ({
            playerId: entry.playerId,
            state: current.phase === 'active' && entry.playerId === activePlayerId ? 'active' : 'waiting',
        })),
    };
}
