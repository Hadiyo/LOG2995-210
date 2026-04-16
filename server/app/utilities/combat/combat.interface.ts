import { GameSessionRuntime } from '@app/utilities/game/game.interface';
import { Timers } from '@app/utilities/turn/turn.interface';
import { FighterStance } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';

export interface Fighter {
    stats: MatchPlayer,
    combatStance: FighterStance,
    hasSelectedStance: boolean,
    hasPenalty: boolean,
}

export interface CombatSession extends Timers {
    id: string,
    gameSessionId: string,
    round: number,
    players: Fighter[],
    winner?: MatchPlayer,
    turnState: MatchTurnState,
}

export interface CombatStartPayload {
    combat: CombatSession,
    game: GameSessionRuntime,
}
