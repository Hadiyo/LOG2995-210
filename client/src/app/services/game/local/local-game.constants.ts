export const GAME_STORAGE_KEYS = {
    sessionId: 'activeGameSessionId',
    playerId: 'activePlayerId',
} as const;

export const LOCAL_GAME_SESSIONS_STORAGE_KEY = 'localGameSessions';

export const DEFAULT_TURN_DURATION_SECONDS = 30;
export const DEFAULT_ACTIONS_PER_TURN = 1;
export const SINGLE_STEP_DISTANCE = 1;
export const TIMER_TICK_MS = 1000;
export const WALK_POSE_DURATION_MS = 180;
export const ATTACK_POSE_DURATION_MS = 220;
export const CHAT_MESSAGE_MAX_LENGTH = 300;
export const D4_MAX = 4;
export const D6_MAX = 6;
