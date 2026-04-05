
export const ACTIVE_COMBAT_TURN_DURATION_MS = 10000;
export const COMBAT_TRANSITION_DURATION_MS = 3000;
export const BONUS = 2;
export const ZERO = 0;
export const MIN_DIE_VALUE = 1;

export enum CombatEvents {
    Turn = 'turnEvent',
    Statistics = 'statistics',
    Victory = 'victory',
    Tie = 'tie',
    ClientDisconnect = 'clientDisconnect'
}