import { MovementDirection } from '@common/game/movement-direction';

export enum GameSessionActionContext {
    Combat = 'combat',
    Door = 'door',
    FlagTransfer = 'flag-transfer',
    Sanctuary = 'sanctuary',
}

export interface GameSessionActionOption {
    context: GameSessionActionContext;
    label: string;
}

export const MOVEMENT_KEY_BINDINGS = new Map<string, MovementDirection>([
    ['KeyW', 'up'],
    ['KeyA', 'left'],
    ['KeyS', 'down'],
    ['KeyD', 'right'],
]);

export const MOVEMENT_DIRECTIONS: MovementDirection[] = ['up', 'left', 'down', 'right'];
export const EDITABLE_TARGET_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const MATCH_END_REDIRECT_DURATION_MS = 5000;
export const CLOCK_TICK_MS = 100;
export const MILLISECONDS_PER_SECOND = 1000;
export const TRANSITION_DURATION_MS = 3000;
export const ACTIVE_TURN_DURATION_MS = 30000;
