import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { GameNotificationsPanelComponent } from '@app/components/game/game-notifications-panel/game-notifications-panel.component';
import { ChatMessage } from '@common/chat/chat.interface';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import { GameNotification } from '@common/game-notification';

@Component({
  selector: 'app-game-chat-panel',
  standalone: true,
  imports: [CommonModule, GameNotificationsPanelComponent],
  templateUrl: './game-chat-panel.component.html',
  styleUrl: './game-chat-panel.component.scss',
})
export class GameChatPanelComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) messages: readonly (ChatMessage | GameLogEntry)[] = [];
  @Input() notification: GameNotification | null = null;
  @Input() currentPlayerName: string | null = null;
  @Input() messageMaxLength = 200;
  @Input() title = 'Messages de partie';
  @Input() showTitle = true;
  @Input() readOnly = false;
  @Output() messageSubmit = new EventEmitter<string>();
  @ViewChild('messagesFeed') private messagesFeedRef?: ElementRef<HTMLDivElement>;

  readonly messageInput = signal('');
  private previousMessageCount = 0;

  @HostBinding('class.chat-panel--no-title')
  protected get noTitleClass(): boolean {
    return !this.showTitle;
  }

  // Scrolls to bottom when new messages arrive, 
  // but only if message count increased (prevents scroll on edits).
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes.messages) return;

    const nextMessageCount = this.messages.length;
    if (nextMessageCount > this.previousMessageCount) {
      queueMicrotask(() => this.scrollMessagesToBottom());
    }
    this.previousMessageCount = nextMessageCount;
  }

  // Initial scroll to bottom on first load if there are existing messages.
  ngAfterViewInit(): void {
    this.previousMessageCount = this.messages.length;
    this.scrollMessagesToBottom();
  }

  // Enforces max length on input and updates bound signal.
  onMessageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nextValue = input.value.slice(0, this.messageMaxLength);
    this.messageInput.set(nextValue);
    input.value = nextValue;
  }

  // Emits current message value and clears input.
  submitMessage(): void {
    if (this.readOnly) return;
    this.messageSubmit.emit(this.messageInput());
    this.messageInput.set('');
  }

  // Helper to identify if a message was sent by the current player for styling.
  isOwnMessage(message: ChatMessage | GameLogEntry): boolean {
    if (!this.currentPlayerName) return false;
    return message.author === this.currentPlayerName;
  }

  hasInvolvedPlayers(message: ChatMessage | GameLogEntry): message is GameLogEntry {
    return Array.isArray((message as GameLogEntry).involvedPlayers) && (message as GameLogEntry).involvedPlayers.length > 0;
  }

  // Scrolls the messages feed to the bottom.
  private scrollMessagesToBottom(): void {
    const feed = this.messagesFeedRef?.nativeElement;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }
}
