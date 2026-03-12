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

  private chatMessages = new BehaviorSubject<ChatMessage[]>([]);
  readonly chat$ = this.chatMessages.asObservable();

  constructor(private socket: SocketManagerService) {}

  initChat(): void {
    if (!this.socket.isSocketAlive())
      this.socket.connect();
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
    this.subscribeToSocketEvents();
  }

  sendMessage(message: ChatMessage): void {
    if (validateChatMessage(message)) {
      this.socket.send(ChatSocketEvents.SendMessage, message);
    }
    else {
      console.error('Invalid chat message');
    }
  }

  subscribeToSocketEvents() {
    this.socket.on<ChatMessage>(ChatSocketEvents.ReceiveMessage, this.onReceiveMessage);
    this.socket.on<ChatMessage[]>(ChatSocketEvents.LoadChatMessages, this.onLoadChatMessages);
    this.socket.on<string>(ChatSocketEvents.ChatValidationError, this.onErrorMessage);
  }

  unsubscribeToSocketEvents() {
    this.socket.off<ChatMessage>(ChatSocketEvents.ReceiveMessage, this.onReceiveMessage);
    this.socket.off<ChatMessage[]>(ChatSocketEvents.LoadChatMessages, this.onLoadChatMessages);
    this.socket.off<string>(ChatSocketEvents.ChatValidationError, this.onErrorMessage);
  }

  private onLoadChatMessages = (messages: ChatMessage[]): void => {
    this.chatMessages.next(messages);
  }

  private onReceiveMessage = (message: ChatMessage): void => {
    this.chatMessages.next([...this.chatMessages.value, message]);
  }

  private onErrorMessage = (errorMessage: string): void => {
    console.error(`Chat error: ${errorMessage}`);
  }
}
