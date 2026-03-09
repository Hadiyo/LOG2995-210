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
}

export interface CreateSessionPayload {
    mapPreview: GameSessionPreview,
    sessionId: string,
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

export interface ChatPayload {
    message: ChatMessage;
    sessionId: string;
}

export interface ChatMessage {
    senderName: string;
    message: string;
    timestamp: string;
}
