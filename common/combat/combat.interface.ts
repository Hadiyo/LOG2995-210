import { MatchPlayer } from '../game/match.interface';
import { MatchTurnState } from '../game/turn.interface';

export type FighterStance = 'attack' | 'defense' | null;

export interface Fighter {
    stats: MatchPlayer,
    combatStance: FighterStance,
    hasPenalty: boolean,
}

export interface CombatSession {
    id: string,
    gameSessionId: string,
    players: Fighter[],
    winner?: MatchPlayer,
    turnState: MatchTurnState,
    transitionTimeoutId: NodeJS.Timeout | null;
    activeTurnTimeoutId: NodeJS.Timeout | null;
    timerIntervalId: NodeJS.Timeout | null;
}

export interface FighterPayload{
    id: string,
    health: number,
}

export interface CombatPlayerStatistics {
    attacker: FighterPayload,
    victim: FighterPayload,
    attackRoll: number,
    defenseRoll: number,
    attack: number,
    defense: number,
}

export interface CombatSessionSnapshot {
    combatId: string,
    statistics: CombatPlayerStatistics[],
}

export interface CombatTurnSnapshot {
    combatId: string,
    turnState: MatchTurnState,
}

export interface CombatResultSnapshot {
    combatId: string,
    gameSessionId: string,
    winner: string,
    loser: string,
}

export interface StancePayload {
    combatId: string,
    playerId: string,
    stance: FighterStance,
}
