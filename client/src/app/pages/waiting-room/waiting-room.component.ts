import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { ChatService } from '@app/services/chat/chat.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import { AvatarId } from '@common/character/character.model';
import { ChatMessage } from '@common/chat/chat.interface';
import { PlayerInformation } from '@common/player/player.interface';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule, GameChatPanelComponent],
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  protected players$: Observable<PlayerInformation[]> = this.waitingRoomService.players$.pipe(
    map((players) => {
      const organizer = players.find((player) => player.isOrganizer);
      const participants = players.filter((player) => !player.isOrganizer);
      return organizer ? [organizer, ...participants] : participants;
    }),
  );
  protected messages$: Observable<ChatMessage[]> = this.chatService.chat$;
  protected isLocked$ = this.waitingRoomService.isLocked$;
  protected maxPlayers$ = this.waitingRoomService.maxPlayers$;
  protected statusMessage$ = this.waitingRoomService.statusMessage$;
  protected takenAvatards: AvatarId[] = [];

  constructor(
    private readonly router: Router,
    private readonly waitingRoomService: WaitingRoomService,
    private readonly chatService: ChatService,
  ) {}

  ngOnInit() {
    this.waitingRoomService.initWaitingRoom();
    this.chatService.initChat();
  }

  ngOnDestroy(): void {
    this.waitingRoomService.unsubscribeSocketEvents();
    this.chatService.unsubscribeToSocketEvents();
  }

  get isOrganizer(): boolean {
    return this.waitingRoomService.me?.isOrganizer ?? false;
  }

  get me(): PlayerInformation | undefined {
    return this.waitingRoomService.me;
  }

  /**
   * Organizer leaves → deletes the whole session (navigates all players out).
   * Regular player leaves → removes themselves from the session.
   */
  protected leaveSession(): void {
    if (this.isOrganizer) {
      this.waitingRoomService.deleteGameSession();
    } else {
      this.waitingRoomService.leaveGameSession();
      void this.router.navigate(['/home']);
    }
    this.chatService.clearChat();
  }

  /**
   * Organizer kicks another player by name.
   */
  protected kickPlayer(player: PlayerInformation): void {
    this.waitingRoomService.kickPlayer(player.name);
  }

  protected startGame(): void {
    if (!this.isOrganizer) {
      return;
    }
    this.waitingRoomService.startGame();
  }

  protected onMessageSubmit(content: string): void {
    const author = this.me?.name;
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

  protected getAvatarThumbPath(avatarId: number): string {
    return resolveAssetUrl(`assets/avatars/thumbs/${avatarId}.png`);
  }
}
