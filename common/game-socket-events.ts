import { GameNotification } from './game-notification';
import { TurnState } from './game-session';
import { GameCell } from './maps/map.interface';
import { GamePlayerState } from './player/player.interface';

export enum SocketEvents {
    // Client-to-server events
    JoinGameSession = 'joinGameSession',
    LeaveGameSession = 'leaveGameSession',
    EndTurn = 'endTurn',
    ToggleActionMode = 'toggleActionMode',
    SurrenderGame = 'surrenderGame',
    SendGameMessage = 'sendGameMessage',
    ExecuteGameAction = 'executeGameAction',

    // Server-to-client events
    GameSessionSnapshot = 'gameSessionSnapshot',
    GamePlayersUpdated = 'gamePlayersUpdated',
    GameTurnUpdated = 'gameTurnUpdated',
    GameMapCellsUpdated = 'gameMapCellsUpdated',
    GameNotificationReceived = 'gameNotificationReceived',
    TurnTimerUpdated = 'turnTimerUpdated',
    GameMessageReceived = 'gameMessageReceived',
    PlayerSurrendered = 'playerSurrendered',
}

// Builds a room key for a specific game session, used for Socket.IO room management.
export const getGameSessionRoom = (sessionId: string): string => `gameSession:${sessionId}`;

// Payload when a player joins a game session.
export interface JoinGameSessionPayload {
    sessionId: string;
    playerId: string;
}

// Payload when a player leaves a game session.
export interface LeaveGameSessionPayload {
    sessionId: string;
    playerId: string;
}

// Payload emitted to end the active player's turn.
export interface EndTurnPayload {
    sessionId: string;
    playerId: string;
}

// Payload to enable or disable action mode for a player.
export interface ToggleActionModePayload {
    sessionId: string;
    playerId: string;
    enabled: boolean;
}

// Types of game actions that can be executed by a player.
export type GameActionType = 'MOVE' | 'ATTACK' | 'INTERACT';

// Payload to execute a game action against a target index.
export interface ExecuteGameActionPayload {
    sessionId: string;
    playerId: string;
    actionType: GameActionType;
    targetIndex: number;
}

// Payload when a player surrenders the game session.
export interface SurrenderGamePayload {
    sessionId: string;
    playerId: string;
}

// Payload for sending a chat/message within a game session.
export interface SendGameMessagePayload {
    sessionId: string;
    playerId: string;
    content: string;
}

// Payload broadcast when the turn timer updates.
export interface TurnTimerUpdatedPayload {
    sessionId: string;
    remainingSeconds: number;
}

// Payload broadcast when player runtime states are updated.
export interface GamePlayersUpdatedPayload {
    sessionId: string;
    players: GamePlayerState[];
}

// Payload broadcast when turn state is updated.
export interface GameTurnUpdatedPayload {
    sessionId: string;
    turn: TurnState;
}

// Patch for one changed map cell.
export interface GameMapCellPatch {
    index: number;
    cell: GameCell;
}

// Payload broadcast when one or more map cells are updated.
export interface GameMapCellsUpdatedPayload {
    sessionId: string;
    cells: GameMapCellPatch[];
}

// Payload broadcast when a gameplay notification is created.
export interface GameNotificationPayload {
    sessionId: string;
    notification: GameNotification;
}
