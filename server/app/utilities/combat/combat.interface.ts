import { Timers } from '@app/utilities/turn/turn.interface';
import { FighterStance } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';

export interface Fighter {
    stats: MatchPlayer,
    combatStance: FighterStance,
    hasPenalty: boolean,
}

export interface CombatSession extends Timers {
    id: string,
    gameSessionId: string,
    players: Fighter[],
    winner?: MatchPlayer,
    turnState: MatchTurnState,
}