import { Component, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EndStatsComponent } from '@app/components/end-stats/end-stats.component';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { GAME_VIEW_CONSTANTS } from '@app/config/game-view.config';
import { ChatService } from '@app/services/chat/chat.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { ChatMessage } from '@common/chat/chat.interface';

@Component({
  selector: 'app-end-game',
  imports: [EndStatsComponent, GameChatPanelComponent],
  templateUrl: './end-game.component.html',
  styleUrl: './end-game.component.scss',
})
export class EndGameComponent implements OnInit, OnDestroy {
  constructor(
    private readonly chatService: ChatService,
    private readonly waitingRoomService: WaitingRoomService,
  ) {}

  protected readonly chatMessages = toSignal(this.chatService.chat$, { initialValue: [] as ChatMessage[] });

  protected readonly constants = GAME_VIEW_CONSTANTS;
  protected currentPlayer = this.waitingRoomService.me;

  ngOnInit(): void {
    this.chatService.initChat();
  }

  ngOnDestroy(): void {
    this.chatService.unsubscribeToSocketEvents();
  }

  protected onChatMessageSubmit(content: string): void {
    const author = this.currentPlayer?.name;
    if (!author) {
        return;
    }

    const message: ChatMessage = {
        author,
        content,
        createdAt: new Date().toISOString(),
    };
    this.chatService.sendMessage(message);
}
}
