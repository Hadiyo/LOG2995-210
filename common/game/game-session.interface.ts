import { MapSize } from "@common/maps/map.enums";
import { PlayerInformation } from "@common/player/player.interface";

export interface GameSession {
    id: string;
    players: string[]; // set of player ids organized by order
    mapTemplateId: string;
    debugMode?: boolean;
}

export interface CreateSessionPayload {
    information: PlayerInformation;
    mapId: string;
}

export interface GameSessionPayload {
    information: PlayerInformation;
    sessionId: string;
}

export interface LeaveSessionPayload {
    playerId: string;
}

export interface GameSessionPreview {
    id: string;
    name: string;
    description: string;
    mode: string;
    size: MapSize;
    nbOfPlayers: number;
    previewImage?: string;
}
