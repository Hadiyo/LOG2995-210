import { ChatMessage } from "@common/chat/chat.interface";

const MAX_MESSAGE_LENGTH = 200; 

export const validateChatMessage = (message: ChatMessage): boolean => { 
    if (!message) return false;
    if (typeof message.senderName !== 'string' || message.senderName.trim() === '') return false;
    if (typeof message.message !== 'string' || message.message.trim() === '') return false;
    if (typeof message.timestamp !== 'string' || isNaN(Date.parse(message.timestamp))) return false;

    if (message.message.trim().length > MAX_MESSAGE_LENGTH) return false;

    return true;
}