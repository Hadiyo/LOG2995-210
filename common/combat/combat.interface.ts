import { MatchTurnState } from '../game/turn.interface';

export type FighterStance = 'attack' | 'defense' | null;

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
