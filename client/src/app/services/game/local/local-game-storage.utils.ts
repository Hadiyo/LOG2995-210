import { GameSessionSnapshot } from '@common/game-session';
import { LOCAL_GAME_SESSIONS_STORAGE_KEY } from './local-game.constants';

const RANDOM_ID_RADIX = 36;
const RANDOM_ID_SLICE_START = 2;
const RANDOM_ID_SLICE_END = 10;

export const persistSessions = (sessions: ReadonlyMap<string, GameSessionSnapshot>): void => {
    const serialized: Record<string, GameSessionSnapshot> = {};
    for (const [sessionId, session] of sessions.entries()) {
        serialized[sessionId] = session;
    }
    sessionStorage.setItem(LOCAL_GAME_SESSIONS_STORAGE_KEY, JSON.stringify(serialized));
};

export const restoreSessions = (): Map<string, GameSessionSnapshot> => {
    const sessions = new Map<string, GameSessionSnapshot>();
    const rawValue = sessionStorage.getItem(LOCAL_GAME_SESSIONS_STORAGE_KEY);
    if (!rawValue) return sessions;

    try {
        const parsed = JSON.parse(rawValue) as Record<string, GameSessionSnapshot>;
        for (const [sessionId, session] of Object.entries(parsed)) {
            sessions.set(sessionId, session);
        }
    } catch {
        sessions.clear();
    }

    return sessions;
};

export const cloneSession = (snapshot: GameSessionSnapshot): GameSessionSnapshot => {
    if (typeof structuredClone === 'function') {
        return structuredClone(snapshot);
    }
    return JSON.parse(JSON.stringify(snapshot)) as GameSessionSnapshot;
};

export const generateLocalId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(RANDOM_ID_RADIX).slice(RANDOM_ID_SLICE_START, RANDOM_ID_SLICE_END)}`;
};
