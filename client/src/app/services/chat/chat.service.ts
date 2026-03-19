import { Injectable, signal } from '@angular/core';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { validateChatMessage } from '@common/chat/chat-validation.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { ChatSocketEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class ChatService {
    readonly state = signal<ServiceState>(ServiceState.Idle);

    private readonly chatMessages = new BehaviorSubject<ChatMessage[]>([]);
    readonly chat$ = this.chatMessages.asObservable();

    constructor(private readonly socket: SocketManagerService) {}

    initChat(): void {
        if (!this.socket.isSocketAlive()) {
            this.socket.connect();
        }
        this.subscribeToSocketEvents();
    }

    sendMessage(message: ChatMessage): void {
        if (validateChatMessage(message)) {
            this.socket.send(ChatSocketEvents.SendMessage, message);
        }
    }

    loadChatMessages(messages: ChatMessage[]): void {
        const existingMessages = this.chatMessages.value;
        const existingIds = new Set(existingMessages.map((msg) => msg.id ?? msg.createdAt));
        const newMessages = messages.filter((msg) => !existingIds.has(msg.id ?? msg.createdAt));
        if (newMessages.length > 0) {
            this.chatMessages.next([...existingMessages, ...newMessages]);
        }
    }

    clearChat(): void {
        this.chatMessages.next([]);
    }

    subscribeToSocketEvents(): void {
        this.socket.on<ChatMessage>(ChatSocketEvents.ReceiveMessage, this.onReceiveMessage);
    }

    unsubscribeToSocketEvents(): void {
        this.socket.off<ChatMessage>(ChatSocketEvents.ReceiveMessage, this.onReceiveMessage);
    }

    private readonly onReceiveMessage = (message: ChatMessage): void => {
        this.chatMessages.next([...this.chatMessages.value, message]);
    };

}
