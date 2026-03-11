// Chat or system message recorded during the session
export interface ChatMessage {
    id: string;
    author: string; // 'SYSTEM' or player name
    content: string;
    createdAt: string; // ISO string
}
