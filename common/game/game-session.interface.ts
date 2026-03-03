
export interface GameSession {
    id: string;
    players: Set<string>; // set of player ids organized by order
    mapTemplateId: string;
    chatSessionId?: string;
    debugMode?: boolean;
}