import { FighterStance } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';

export interface Fighter {
    stats: MatchPlayer,
    combatStance: FighterStance,
    hasSelectedStance: boolean,
    hasPenalty: boolean,
}

export interface CombatSession {
    id: string,
    gameSessionId: string,
    round: number,
    players: Fighter[],
    winner?: MatchPlayer,
    turnState: MatchTurnState,
    transitionTimeoutId: NodeJS.Timeout | null;
    activeTurnTimeoutId: NodeJS.Timeout | null;
    timerIntervalId: NodeJS.Timeout | null;
}
