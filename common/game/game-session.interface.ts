import { PlayerInformation } from "@common/player/player.interface";

export interface GameSession {
    id: string;
    players: string[]; // set of player ids organized by order
    mapTemplateId: string;
    chatSessionId?: string;
    debugMode?: boolean;
}

export interface GameSessionPayload {
    information: PlayerInformation;
    mapId: string;
}