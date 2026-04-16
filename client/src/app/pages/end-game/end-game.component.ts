import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { EndStatsComponent } from '@app/components/end-stats/end-stats.component';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { GAME_VIEW_CONSTANTS } from '@app/config/game-view.config';
import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { GameSessionDisplayService } from '@app/services/game-view/game-session-display.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { ChatMessage } from '@common/chat/chat.interface';

@Component({
  selector: 'app-end-game',
  imports: [EndStatsComponent, GameChatPanelComponent, BackButtonComponent],
  templateUrl: './end-game.component.html',
  styleUrl: './end-game.component.scss',
  providers: [GameSessionDisplayService],
})
export class EndGameComponent implements OnInit, OnDestroy {
  constructor(
    private readonly chatService: ChatService,
    private readonly waitingRoomService: WaitingRoomService,
    private readonly router: Router,
    private readonly gameSessionSocket: GameSessionSocketService,
    private readonly matchState: MatchStateService,
  ) {}
  
  private readonly display = inject(GameSessionDisplayService);

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

  @HostListener('window:beforeunload')
  protected handleBrowserRefresh(): void {
      if (!this.display.localPlayer()) {
          return;
      }

      const message = this.display.matchEndState()?.message ??
          'Rafraichissement detecte: la partie a ete consideree comme un abandon.';
      this.leaveMatch(message);
  }

  protected leaveMatch(message: string): void {
    if (this.currentPlayer) {
      this.gameSessionSocket.surrender(this.currentPlayer.id);
    }

    this.matchState.abandonLocalPlayer(message);
    void this.router.navigate(['/home']);
  }
}
