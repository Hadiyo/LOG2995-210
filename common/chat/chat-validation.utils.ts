import { ChatMessage } from "@common/chat/chat.interface";

const MAX_MESSAGE_LENGTH = 200; 

export const validateChatMessage = (message: ChatMessage): boolean => { 
    if (!message) return false;
    if (typeof message.author !== 'string' || message.author.trim() === '') return false;
    if (typeof message.content !== 'string' || message.content.trim() === '') return false;
    if (typeof message.createdAt !== 'string' || isNaN(Date.parse(message.createdAt))) return false;

    if (message.content.length > MAX_MESSAGE_LENGTH) return false;

    return true;
}