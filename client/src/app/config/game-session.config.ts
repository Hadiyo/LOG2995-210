import { MovementDirection } from '@app/services/match/match-movement.service';

export type GameSessionActionContext = 'combat' | 'door' | 'sanctuary';

export interface GameSessionActionOption {
    context: GameSessionActionContext;
    label: string;
}

export interface LocalCombatNotification {
    id: string;
    message: string;
}

export const MOVEMENT_KEY_BINDINGS = new Map<string, MovementDirection>([
    ['KeyW', 'up'],
    ['KeyA', 'left'],
    ['KeyS', 'down'],
    ['KeyD', 'right'],
]);

export const MOVEMENT_DIRECTIONS: MovementDirection[] = ['up', 'left', 'down', 'right'];
export const EDITABLE_TARGET_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const COMBAT_NOTIFICATION_DURATION_MS = 3000;
export const MATCH_END_REDIRECT_DURATION_MS = 5000;
export const CLOCK_TICK_MS = 100;
export const MILLISECONDS_PER_SECOND = 1000;
export const TRANSITION_DURATION_MS = 3000;
export const ACTIVE_TURN_DURATION_MS = 30000;
