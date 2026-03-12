import { Injectable, signal } from '@angular/core';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { validateChatMessage } from '@common/chat/chat-validation.utils';
import { ChatMessage, ChatPayload } from '@common/chat/chat.interface';
import { ChatSocketEvents } from '@common/socket-events';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  readonly state = signal<ServiceState>(ServiceState.Idle);

  private chatMessages = signal<ChatMessage[]>([]);
  readonly chat$ = this.chatMessages.asReadonly();

  constructor(private socket: SocketManagerService) {}

  initChat(): void {
    if (!this.socket.isSocketAlive())
      this.socket.connect();
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
  }

  sendMessage(payload: ChatPayload): void {
    if (validateChatMessage(payload.message)) {
      this.socket.send(ChatSocketEvents.SendMessage, payload);
    }
    else {
      console.error('Invalid chat message');
    }
  }

  subscribeToSessionEvents() {
    this.socket.on<ChatPayload>(ChatSocketEvents.ReceiveMessage, this.onRecieveMessage);
    this.socket.on<ChatMessage[]>(ChatSocketEvents.LoadChatMessages, this.onLoadChatMessages);
    this.socket.on<string>(ChatSocketEvents.ChatValidationError, this.onErrorMessage);
  }

  unsubscribeToSessionEvents() {
    this.socket.off<ChatPayload>(ChatSocketEvents.ReceiveMessage, this.onRecieveMessage);
    this.socket.off<ChatMessage[]>(ChatSocketEvents.LoadChatMessages, this.onLoadChatMessages);
    this.socket.off<string>(ChatSocketEvents.ChatValidationError, this.onErrorMessage);
  }

  onLoadChatMessages = (messages: ChatMessage[]): void => {
    this.chatMessages.set(messages);
  }

  onRecieveMessage = (payload: ChatPayload): void => {
    this.chatMessages.update(messages => [...messages, payload.message]);
  }

  onErrorMessage = (errorMessage: string): void => {
    console.error(`Chat error: ${errorMessage}`);
  }
}
