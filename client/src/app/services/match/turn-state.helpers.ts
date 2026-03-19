import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchPlayerTurnState, MatchTurnOrderEntry, MatchTurnState } from '@common/game/turn.interface';
import { shuffle } from './match-geometry';

export const buildTurnOrderFromPlayers = (players: MatchPlayer[], random: () => number): MatchTurnOrderEntry[] => {
    const playersBySpeed = new Map<number, MatchPlayer[]>();

    players.forEach((player) => {
        const group = playersBySpeed.get(player.speed) ?? [];
        group.push(player);
        playersBySpeed.set(player.speed, group);
    });

    return [...playersBySpeed.entries()]
        .sort(([leftSpeed], [rightSpeed]) => rightSpeed - leftSpeed)
        .flatMap(([speed, groupedPlayers]) =>
            shuffle(groupedPlayers, random).map((player) => ({
                playerId: player.id,
                speed,
            })),
        );
};

export const buildPlayerStates = (
    order: MatchTurnOrderEntry[],
    activePlayerId: string | null = null,
): MatchPlayerTurnState[] =>
    order.map((entry) => ({
        playerId: entry.playerId,
        state: entry.playerId === activePlayerId ? 'active' : 'waiting',
    }));

export const isReusableTurnState = (persistedState: MatchTurnState, match: InitializedMatch): boolean => {
    if (persistedState.matchId !== match.mapId) return false;
    if (persistedState.phase !== 'transition' && persistedState.phase !== 'active') return false;
    if (persistedState.order.length !== match.players.length) return false;

    const playersById = new Map(match.players.map((player) => [player.id, player.speed]));
    return persistedState.order.every((entry) => playersById.get(entry.playerId) === entry.speed);
};

const getNormalizedPhase = (state: MatchTurnState): 'active' | 'transition' =>
    state.phase === 'active' ? 'active' : 'transition';

const getTransitionTimers = (state: MatchTurnState) => ({
    transitionTargetPlayerId: state.transitionTargetPlayerId ?? null,
    transitionEndsAt: state.transitionEndsAt ?? null,
    transitionRemainingMs: state.transitionRemainingMs ?? 0,
    activeTurnEndsAt: null,
    activeTurnRemainingMs: 0,
    movementPointsRemaining: 0,
    actionTaken: false,
    movementCount: 0,
});

const getActiveTurnTimers = (state: MatchTurnState) => ({
    transitionTargetPlayerId: null,
    transitionEndsAt: null,
    transitionRemainingMs: 0,
    activeTurnEndsAt: state.activeTurnEndsAt ?? null,
    activeTurnRemainingMs: state.activeTurnRemainingMs ?? 0,
    movementPointsRemaining: state.movementPointsRemaining ?? 0,
    actionTaken: state.actionTaken ?? false,
    movementCount: state.movementCount ?? 0,
});

export const normalizePersistedTurnState = (state: MatchTurnState | null): MatchTurnState | null => {
    if (!state) {
        return null;
    }

    const phase = getNormalizedPhase(state);
    const activePlayerId = phase === 'active' ? state.activePlayerId ?? null : null;
    const normalizedTurnTimers = phase === 'active' ? getActiveTurnTimers(state) : getTransitionTimers(state);

    return {
        ...state,
        hasStarted: state.hasStarted ?? phase === 'active',
        phase,
        activePlayerId,
        ...normalizedTurnTimers,
        playerStates: state.playerStates ?? buildPlayerStates(state.order, activePlayerId),
    };
};

export const clearWindowTimer = (timerId: number | null): null => {
    if (timerId !== null) {
        window.clearInterval(timerId);
    }

    return null;
};

export const readStoredJson = <T>(key: string): T | null => {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return null;

    try {
        return JSON.parse(rawValue) as T;
    } catch {
        localStorage.removeItem(key);
        return null;
    }
};
