import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { TileType } from '@common/maps/map.enums';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import {
    ICE_COMBAT_PENALTY,
    MAX_STANCE_BONUS,
    MILLISECONDS_PER_SECOND,
    MINIMUM_COUNTDOWN_SECONDS,
    NO_DAMAGE,
    NO_PENALTY,
} from './combat-state.constants';
import { CombatPanelFighterOptions } from './combat-state.interfaces';
import {
    CombatOutcomeNotice,
    CombatPanelFighter,
    CombatPanelOrientation,
    CombatPanelState,
    CombatResultPayload,
    CombatRoundBreakdown,
    CombatRoundFighterLog,
    CombatRoundLog,
    CombatStanceChoice,
    CombatTiePayload,
} from './combat-state.models';

export function createPendingRoundLog(panelState: CombatPanelState, localSelectedStance: CombatStanceChoice): CombatRoundLog {
    return {
        id: `${panelState.id}-round-${panelState.round}`,
        round: panelState.round,
        status: 'pending',
        fighters: panelState.fighters.map((fighter) =>
            createPendingRoundFighterLog(fighter, fighter.isLocal ? localSelectedStance : null),
        ) as [CombatRoundFighterLog, CombatRoundFighterLog],
    };
}

export function createResolvedRoundLog(
    panelState: CombatPanelState,
    statistics: CombatPlayerStatistics[],
): CombatRoundLog | null {
    const roundFighterLogs = panelState.fighters.map((fighter) => createResolvedRoundFighterLog(fighter, statistics));
    if (roundFighterLogs.some((fighter) => !fighter)) {
        return null;
    }

    return {
        id: `${panelState.id}-round-${panelState.round}`,
        round: panelState.round,
        status: 'revealing',
        fighters: roundFighterLogs as [CombatRoundFighterLog, CombatRoundFighterLog],
    };
}

export function revealRoundLog(roundLogs: CombatRoundLog[], round: number): CombatRoundLog[] {
    return roundLogs.map((roundLog) =>
        roundLog.round === round && roundLog.status === 'revealing'
            ? { ...roundLog, status: 'resolved' }
            : roundLog,
    );
}

export function createVictoryNotice(
    players: readonly MatchPlayer[],
    payload: CombatResultPayload,
    causedByDisconnect: boolean,
): CombatOutcomeNotice | null {
    const winner = players.find((player) => player.id === payload.winner) ?? null;
    const loser = players.find((player) => player.id === payload.loser) ?? null;
    if (!winner || !loser) {
        return null;
    }

    const suffix = causedByDisconnect ? ' par abandon' : '';
    return {
        id: `${payload.winner}:${payload.loser}:${Date.now()}`,
        attackerId: payload.winner,
        defenderId: payload.loser,
        attackerMessage: `Victoire contre ${loser.name}${suffix}.`,
        defenderMessage: `Défaite contre ${winner.name}${suffix}.`,
        logMessage: `${winner.name} remporte le combat contre ${loser.name}${suffix}.`,
    };
}

export function createTieNotice(players: readonly MatchPlayer[], payload: CombatTiePayload): CombatOutcomeNotice | null {
    const player1 = players.find((player) => player.id === payload.player1) ?? null;
    const player2 = players.find((player) => player.id === payload.player2) ?? null;
    if (!player1 || !player2) {
        return null;
    }

    return {
        id: `${payload.player1}:${payload.player2}:${Date.now()}`,
        attackerId: payload.player1,
        defenderId: payload.player2,
        attackerMessage: `Égalité contre ${player2.name}.`,
        defenderMessage: `Égalité contre ${player1.name}.`,
        logMessage: `${player1.name} et ${player2.name} terminent le combat à égalité.`,
    };
}

export function getCountdownSeconds(turnState: MatchTurnState): number {
    const remainingMs = turnState.phase === 'active'
        ? turnState.activeTurnRemainingMs
        : turnState.transitionRemainingMs;
    return Math.max(MINIMUM_COUNTDOWN_SECONDS, Math.ceil(remainingMs / MILLISECONDS_PER_SECOND));
}

export function getUpdatedHealthByFighterId(statistics: CombatPlayerStatistics[]): Map<string, number> {
    const updatedHealthByFighterId = new Map<string, number>();
    statistics.forEach((entry) => {
        updatedHealthByFighterId.set(entry.attacker.id, entry.attacker.health);
        updatedHealthByFighterId.set(entry.victim.id, entry.victim.health);
    });
    return updatedHealthByFighterId;
}

export function getDamageTakenByFighterId(statistics: CombatPlayerStatistics[]): Map<string, number> {
    const damageTakenByFighterId = new Map<string, number>();
    statistics.forEach((entry) => {
        const damage = Math.max(NO_DAMAGE, entry.attack - entry.defense);
        const previousDamage = damageTakenByFighterId.get(entry.victim.id) ?? NO_DAMAGE;
        damageTakenByFighterId.set(entry.victim.id, previousDamage + damage);
    });
    return damageTakenByFighterId;
}

export function resolveCombatParticipants(
    players: readonly MatchPlayer[],
    turnState: MatchTurnState,
): [MatchPlayer, MatchPlayer] | null {
    if (turnState.order.length < 2) {
        return null;
    }

    const attacker = players.find((player) => player.id === turnState.order[0]?.playerId) ?? null;
    const defender = players.find((player) => player.id === turnState.order[1]?.playerId) ?? null;
    return attacker && defender ? [attacker, defender] : null;
}

export function upsertRoundLog(roundLogs: CombatRoundLog[], nextRoundLog: CombatRoundLog): CombatRoundLog[] {
    const nextLogs = [...roundLogs];
    const roundIndex = nextLogs.findIndex((roundLog) => roundLog.round === nextRoundLog.round);
    if (roundIndex === -1) {
        nextLogs.push(nextRoundLog);
        return nextLogs;
    }

    if (nextLogs[roundIndex].status === 'pending' || nextRoundLog.status !== 'pending') {
        nextLogs[roundIndex] = nextRoundLog;
    }

    return nextLogs;
}

function createPendingRoundFighterLog(fighter: CombatPanelFighter, stance: CombatStanceChoice): CombatRoundFighterLog {
    return {
        fighterId: fighter.id,
        fighterName: fighter.name,
        isLocal: fighter.isLocal,
        stance,
        attack: createBreakdown(fighter.baseAttack, stance === 'attack' ? MAX_STANCE_BONUS : NO_PENALTY, fighter.attackDie, fighter.tileType),
        defense: createBreakdown(fighter.baseDefense, stance === 'defense' ? MAX_STANCE_BONUS : NO_PENALTY, fighter.defenseDie, fighter.tileType),
        attackDelta: null,
        damage: null,
    };
}

function createResolvedRoundFighterLog(
    fighter: CombatPanelFighter,
    statistics: CombatPlayerStatistics[],
): CombatRoundFighterLog | null {
    const attackStatistics = statistics.find((entry) => entry.attacker.id === fighter.id) ?? null;
    const defenseStatistics = statistics.find((entry) => entry.victim.id === fighter.id) ?? null;
    if (!attackStatistics || !defenseStatistics) {
        return null;
    }

    const penalty = getPenalty(fighter.tileType);
    const attackPostureBonus = attackStatistics.attack - fighter.baseAttack - attackStatistics.attackRoll - penalty;
    const defensePostureBonus = defenseStatistics.defense - fighter.baseDefense - defenseStatistics.defenseRoll - penalty;
    const attackDelta = attackStatistics.attack - attackStatistics.defense;

    return {
        fighterId: fighter.id,
        fighterName: fighter.name,
        isLocal: fighter.isLocal,
        stance: getResolvedStance(attackPostureBonus, defensePostureBonus),
        attack: {
            base: fighter.baseAttack,
            postureBonus: attackPostureBonus,
            dieType: fighter.attackDie,
            dieValue: attackStatistics.attackRoll,
            penalty,
            total: attackStatistics.attack,
        },
        defense: {
            base: fighter.baseDefense,
            postureBonus: defensePostureBonus,
            dieType: fighter.defenseDie,
            dieValue: defenseStatistics.defenseRoll,
            penalty,
            total: defenseStatistics.defense,
        },
        attackDelta,
        damage: attackDelta > NO_DAMAGE ? attackDelta : NO_DAMAGE,
    };
}

function createBreakdown(base: number, postureBonus: number, dieType: CombatRoundBreakdown['dieType'], tileType: TileType): CombatRoundBreakdown {
    return {
        base,
        postureBonus,
        dieType,
        dieValue: null,
        penalty: getPenalty(tileType),
        total: null,
    };
}

function getPenalty(tileType: TileType): number {
    return tileType === TileType.ICE ? ICE_COMBAT_PENALTY : NO_PENALTY;
}

function getResolvedStance(attackPostureBonus: number, defensePostureBonus: number): CombatStanceChoice {
    if (attackPostureBonus >= MAX_STANCE_BONUS) {
        return 'attack';
    }

    if (defensePostureBonus >= MAX_STANCE_BONUS) {
        return 'defense';
    }

    return null;
}

export function getCombatOrientation(attacker: MatchPlayer, defender: MatchPlayer): CombatPanelOrientation {
    return attacker.position.y === defender.position.y ? 'horizontal' : 'vertical';
}

export function getOrderedCombatPlayers(
    attacker: MatchPlayer,
    defender: MatchPlayer,
    orientation: CombatPanelOrientation,
): [MatchPlayer, MatchPlayer] {
    if (orientation === 'horizontal') {
        return attacker.position.x <= defender.position.x ? [attacker, defender] : [defender, attacker];
    }

    return attacker.position.y <= defender.position.y ? [attacker, defender] : [defender, attacker];
}

export function createCombatPanelFighter(options: CombatPanelFighterOptions): CombatPanelFighter {
    const {
        player,
        index,
        localPlayerId,
        currentHealth,
        previousFighter,
        tileType,
        isDoorOpen,
        keepAnimatedPose,
    } = options;

    return {
        id: player.id,
        name: player.name,
        avatarId: player.avatarId,
        attackDie: player.attackDie,
        defenseDie: player.defenseDie,
        attackRollValue: previousFighter?.attackRollValue ?? null,
        defenseRollValue: previousFighter?.defenseRollValue ?? null,
        rollToken: previousFighter?.rollToken ?? 0,
        baseAttack: player.baseAttack,
        baseDefense: player.baseDefense,
        currentHealth,
        maxHealth: player.maxHealth,
        tileType,
        isDoorOpen,
        facing: index === 0 ? PlayerFacing.Right : PlayerFacing.Left,
        pose: getRetainedCombatState(keepAnimatedPose, previousFighter?.pose, PlayerPose.Idle),
        isDefending: getRetainedCombatState(keepAnimatedPose, previousFighter?.isDefending, false),
        isHit: getRetainedCombatState(keepAnimatedPose, previousFighter?.isHit, false),
        teamId: player.teamId ?? null,
        isLocal: player.id === localPlayerId,
    };
}

export function getTileTypeForCombatPlayer(match: InitializedMatch | null, player: MatchPlayer): TileType {
    const cell = match?.map.find((candidate) =>
        candidate.position.x === player.position.x && candidate.position.y === player.position.y,
    ) ?? null;
    return cell?.tileType ?? TileType.DIRT;
}

export function isOpenDoorForCombatPlayer(match: InitializedMatch | null, player: MatchPlayer): boolean {
    const cell = match?.map.find((candidate) =>
        candidate.position.x === player.position.x && candidate.position.y === player.position.y,
    ) ?? null;
    return !!cell && cell.tileType === TileType.DOOR && cell.isWalkable;
}

function getRetainedCombatState<T>(keepAnimatedPose: boolean, previousValue: T | null | undefined, fallback: T): T {
    if (!keepAnimatedPose) {
        return fallback;
    }

    return previousValue ?? fallback;
}
