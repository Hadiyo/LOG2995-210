import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import { ChatMessage } from '@common/chat/chat.interface';
import { MatchLobbyPlayer, VirtualPlayerProfile } from '@common/game/match.interface';
import { combineLatest, map, Observable } from 'rxjs';

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule, GameChatPanelComponent],
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
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
  protected errorMessage$ = this.waitingRoomService.error$;
  protected canAddVirtualPlayers$ = combineLatest([
    this.players$,
    this.isLocked$,
    this.maxPlayers$,
  ]).pipe(
    map(([players, isLocked, maxPlayers]) => this.isOrganizer && !isLocked && players.length < maxPlayers),
  );
  protected virtualPlayerHelpText$ = combineLatest([
    this.players$,
    this.isLocked$,
    this.maxPlayers$,
  ]).pipe(
    map(([players, isLocked, maxPlayers]) => {
      if (!this.isOrganizer || maxPlayers <= 0) {
        return '';
      }

      if (players.length >= maxPlayers) {
        return 'Aucun emplacement libre pour ajouter un JV.';
      }

      if (isLocked) {
        return 'La salle est verrouillee pendant le lancement de la partie.';
      }

      return 'Ajoutez un JV agressif ou defensif. Il pourra ensuite etre retire depuis cette liste.';
    }),
  );

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

  protected addVirtualPlayer(profile: VirtualPlayerProfile): void {
    this.waitingRoomService.addVirtualPlayer(profile);
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

  protected getVirtualPlayerLabel(player: MatchLobbyPlayer): string {
    if (player.controller !== 'virtual') {
      return '';
    }

    return player.virtualProfile === 'defensive' ? 'Bot defensif' : 'Bot agressif';
  }
}
