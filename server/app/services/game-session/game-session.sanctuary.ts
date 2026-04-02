import {
    InitializedMatch,
    MatchPendingSanctuaryChoice,
    MatchSanctuaryChoice,
    MatchPlayer,
} from '@common/game/match.interface';
import { ObjectType } from '@common/maps/map.enums';
import { Vec2 } from '@common/maps/map.interface';
import {
    ARENA_BUFF_TURNS,
    SANCTUARY_COOLDOWN_TURNS,
    SANCTUARY_DOUBLE_OR_NOTHING_THRESHOLD,
    SANCTUARY_HEAL_VALUE,
    getGameSessionObjectFootprint,
    isGameSessionSanctuaryActive,
    isGameSessionSanctuaryObject,
} from './game-session.match';

export interface GameSessionSanctuaryResolution {
    nextMatch: InitializedMatch;
    actionConsumed: boolean;
}

export function beginGameSessionSanctuaryChoice(
    match: InitializedMatch,
    playerId: string,
    sanctuaryId: number,
): MatchPendingSanctuaryChoice | null {
    if (match.pendingSanctuaryChoice) {
        return null;
    }

    const player = match.players.find((candidate) => candidate.id === playerId) ?? null;
    const sanctuary = match.allObjects.find((object) => object.id === sanctuaryId && isGameSessionSanctuaryObject(object)) ?? null;
    if (!player || !sanctuary || !isGameSessionSanctuaryActive(match, sanctuaryId)) {
        return null;
    }

    const adjacent = getGameSessionObjectFootprint(sanctuary).some((tile) => areAdjacent(player.position, tile));
    if (!adjacent) {
        return null;
    }

    if (sanctuary.type === ObjectType.ARENA && (player.arenaBuffTurnsRemaining ?? 0) > 0) {
        return null;
    }

    return { playerId, objectId: sanctuaryId };
}

export function resolveGameSessionSanctuaryChoice(
    match: InitializedMatch,
    choice: MatchSanctuaryChoice,
    random: () => number,
): GameSessionSanctuaryResolution | null {
    const pendingChoice = match.pendingSanctuaryChoice;
    if (!pendingChoice) {
        return null;
    }

    if (choice === 'cancel') {
        return {
            nextMatch: {
                ...match,
                pendingSanctuaryChoice: null,
            },
            actionConsumed: false,
        };
    }

    const sanctuary = match.allObjects.find((object) => object.id === pendingChoice.objectId && isGameSessionSanctuaryObject(object)) ?? null;
    const player = match.players.find((candidate) => candidate.id === pendingChoice.playerId) ?? null;
    if (!sanctuary || !player || !isGameSessionSanctuaryActive(match, sanctuary.id)) {
        return null;
    }

    const multiplier = choice === 'normal' ? 1 : (random() >= SANCTUARY_DOUBLE_OR_NOTHING_THRESHOLD ? 2 : 0);
    const nextPlayers = match.players.map((candidate) => updateSanctuaryTarget(candidate, player.id, sanctuary.type, multiplier));
    const nextSanctuaryStates = (match.sanctuaryStates ?? []).map((state) =>
        state.objectId === sanctuary.id ? { ...state, cooldownTurnsRemaining: SANCTUARY_COOLDOWN_TURNS } : state,
    );

    return {
        nextMatch: {
            ...match,
            players: nextPlayers,
            sanctuaryStates: nextSanctuaryStates,
            pendingSanctuaryChoice: null,
        },
        actionConsumed: true,
    };
}

export function progressGameSessionSanctuaryEffects(match: InitializedMatch, completedPlayerId: string | null): InitializedMatch {
    const nextPlayers = match.players.map((player) => {
        if (player.id !== completedPlayerId || (player.arenaBuffTurnsRemaining ?? 0) <= 0) {
            return player;
        }

        const nextRemainingTurns = (player.arenaBuffTurnsRemaining ?? 0) - 1;
        return {
            ...player,
            arenaBuffTurnsRemaining: nextRemainingTurns,
            attackBonus: nextRemainingTurns > 0 ? player.attackBonus ?? 0 : 0,
            defenseBonus: nextRemainingTurns > 0 ? player.defenseBonus ?? 0 : 0,
        };
    });

    const nextSanctuaryStates = (match.sanctuaryStates ?? []).map((state) => ({
        ...state,
        cooldownTurnsRemaining: Math.max(0, state.cooldownTurnsRemaining - 1),
    }));

    return {
        ...match,
        players: nextPlayers,
        sanctuaryStates: nextSanctuaryStates,
        pendingSanctuaryChoice: null,
    };
}

function updateSanctuaryTarget(player: MatchPlayer, targetPlayerId: string, sanctuaryType: ObjectType, multiplier: number): MatchPlayer {
    if (player.id !== targetPlayerId) {
        return player;
    }

    if (sanctuaryType === ObjectType.REGEN) {
        return {
            ...player,
            health: Math.min(player.maxHealth, player.health + (SANCTUARY_HEAL_VALUE * multiplier)),
        };
    }

    return {
        ...player,
        attackBonus: multiplier,
        defenseBonus: multiplier,
        arenaBuffTurnsRemaining: multiplier > 0 ? ARENA_BUFF_TURNS : player.arenaBuffTurnsRemaining ?? 0,
    };
}

function areAdjacent(left: Vec2, right: Vec2): boolean {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
}
