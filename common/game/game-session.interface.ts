import { ChatMessage } from '@common/chat/chat.interface';
import { GameNotification } from '@common/game-notification';
import { GameSessionSnapshot } from '@common/game-session';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { PlayerInformation } from '@common/player/player.interface';

export interface GameSession {
    id: string;
    players: string[]; // set of player ids organized by order
    mapTemplateId: string; // GameMap and GameSessionPreview have the id
    debugMode?: boolean;
    isLocked: boolean;
    maxPlayers: number;
    messages: ChatMessage[];
    hasStarted: boolean;
}

export interface GameSessionPayload {
    information: PlayerInformation;
    sessionId: string;
}

export interface PlayerPayload {
    waitingRoom: WaitingRoom,
    mapPreview: GameSessionPreview,
}

export interface JoinSessionPayload {
    id: string | undefined,
    character: PlayerInformation,
}

export interface GameSessionPreview {
    id: string;
    name: string;
    description: string;
    mode: GameMode;
    size: MapSize;
    nbOfPlayers: number;
    maxPlayers: number;
    isLocked: boolean;
    previewImage?: string;
    previewImageFormat?: string;
}

export interface WaitingRoom {
    sessionId: string;
    mapPreviewId: string;
    players: PlayerInformation[];
    clientPlayer?: PlayerInformation;
    messages: ChatMessage[];
    isLocked: boolean;
    maxPlayers: number;
}

export interface WaitingRoomMessagePayload {
    content: string;
}

export interface WaitingRoomRedirectPayload {
    sessionId: string,
    reason: string;
}

export interface GameStartedPayload {
    snapshot: GameSessionSnapshot;
}

// Types of game actions that can be executed by a player.
export type GameActionType = 'MOVE' | 'ATTACK' | 'INTERACT';

// Payload broadcast when a gameplay notification is created.
export interface GameNotificationPayload {
    sessionId: string;
    notification: GameNotification;
}
