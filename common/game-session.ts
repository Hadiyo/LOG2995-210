import { ChatMessage } from './chat/chat.interface';
import { GameMap } from './maps/map.interface';
import { Player } from './player/player.interface';

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
    players: Player[];
    map: GameMap;
}

// Snapshot runtime state of an active game session, used for broadcasting updates
export interface GameSessionSnapshot extends Game {
    turn: TurnState;
    messages: ChatMessage[];
    debugMode: boolean;
    createdAt: string;
}
