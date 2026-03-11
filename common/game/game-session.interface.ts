import { GameNotification } from "@common/game-notification";
import { GameMode, MapSize } from "@common/maps/map.enums";
import { Player, PlayerInformation } from "@common/player/player.interface";

export interface GameSession {
    id: string;
    players: string[]; // set of player ids organized by order
    mapTemplateId: string; // GameMap and GameSessionPreview have the id
    debugMode?: boolean;
}

export interface GameSessionPayload {
    information: PlayerInformation;
    sessionId: string;
}

export interface PlayerPayload {
    player: Player,
    sessionId: string,
    mapPreviewId: string,
}

export interface CreateSessionPayload {
    mapPreview: GameSessionPreview,
    sessionId: string,
    player: Player,
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
    previewImage?: string;
    previewImageFormat?: string;
}

// Types of game actions that can be executed by a player.
export type GameActionType = 'MOVE' | 'ATTACK' | 'INTERACT';

// Payload broadcast when a gameplay notification is created.
export interface GameNotificationPayload {
    sessionId: string;
    notification: GameNotification;
}

export interface ChatPayload {
    message: ChatMessage;
    sessionId: string;
}

export interface ChatMessage {
    senderName: string;
    message: string;
    timestamp: string;
}
