import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import { ChatMessage } from '@common/chat/chat.interface';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-game-view',
  imports: [CommonModule, GameChatPanelComponent],
  templateUrl: './game-view.component.html',
  styleUrls: ['./game-view.component.scss'],
})
export class GameViewComponent implements OnInit, OnDestroy {
  protected players$: Observable<MatchLobbyPlayer[]> = this.waitingRoomService.players$.pipe(
    map((players) => {
      const organizer = players.find((player) => player.isOrganizer);
      const participants = players.filter((player) => !player.isOrganizer);
      return organizer ? [organizer, ...participants] : participants;
    }),
  );
  protected messages$: Observable<ChatMessage[]> = this.waitingRoomService.messages$;
  protected isLocked$ = this.waitingRoomService.isLocked$;
  protected maxPlayers$ = this.waitingRoomService.maxPlayers$;
  protected statusMessage$ = this.waitingRoomService.statusMessage$;

  constructor(
    private readonly router: Router,
    private readonly waitingRoomService: WaitingRoomService,
  ) {}

  ngOnInit(): void {
    this.waitingRoomService.initWaitingRoom();
  }

  ngOnDestroy(): void {
    this.waitingRoomService.unsubscribeSocketEvents();
  }

  get isOrganizer(): boolean {
    return this.waitingRoomService.me?.isOrganizer ?? false;
  }

  get me(): MatchLobbyPlayer | null {
    return this.waitingRoomService.me;
  }

  protected leaveSession(): void {
    if (this.isOrganizer) {
      this.waitingRoomService.deleteGameSession();
    } else {
      this.waitingRoomService.leaveGameSession();
      void this.router.navigate(['/home']);
    }
  }

  protected kickPlayer(player: MatchLobbyPlayer): void {
    this.waitingRoomService.kickPlayer(player.id);
  }

  protected startGame(): void {
    if (!this.isOrganizer) {
      return;
    }
    this.waitingRoomService.startGame();
  }

  protected onMessageSubmit(content: string): void {
    this.waitingRoomService.sendMessage(content);
  }

  protected getAvatarThumbPath(avatarId: number): string {
    return resolveAssetUrl(`assets/avatars/thumbs/${avatarId}.png`);
  }
}
