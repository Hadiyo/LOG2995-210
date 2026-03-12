export interface ChatPayload {
    message: ChatMessage;
    sessionId: string;
}

export interface ChatMessage {
    senderName: string;
    message: string;
    timestamp: string;
}