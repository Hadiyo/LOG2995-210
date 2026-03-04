import { ChatMessage } from './chat-message';
import { MapSize } from './maps/map.enums';
import { GameMap } from './maps/map.interface';
import { GamePlayerState } from './player/player.interface';

// Represents the current phase of a turn in the game session
export enum TurnPhase {
    Turn = 'TURN',
    Transition = 'TRANSITION',
}

// Turn management state for the current match
export interface TurnState {
    order: string[]; // Ordered list of player IDs representing turn order
    activePlayerId: string;
    turnNumber: number;
    remainingSeconds: number; // Seconds left in the current turn
    totalSeconds: number;
    phase: TurnPhase;
}

// Base runtime game aggregate (map + players)
export interface Game {
    id: string;
    players: GamePlayerState[];
    map: GameMap;
}

// Snapshot runtime state of an active game session, used for broadcasting updates
export interface GameSessionSnapshot extends Game {
    turn: TurnState;
    messages: ChatMessage[];
    debugMode: boolean;
    createdAt: string;
}

// Request payload to create a new game session
export interface CreateGameSessionRequest {
    mapId: string; // ID of the map to use for the session
    players: GamePlayerState[]; // Initial player states
    debugMode?: boolean;
    turnDurationSeconds?: number; // Optional custom turn duration
    devFallbackMapSize?: MapSize; // Optional debug-only fallback when map loading fails
}
