import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@app/services/session/session.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { PlayerInformation } from '@common/player/player.interface';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule], // pour le ngIf
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  protected players$: Observable<PlayerInformation[]> = this.waitingRoomService.players$;
  protected canStart$ = this.players$.pipe(map(players => this.isOrganizer && players.length >= 2));
  protected errorMessage = '';

  constructor(private router: Router, 
    private waitingRoomService: WaitingRoomService,
    private sessionService: SessionService) {}

  ngOnInit() {
    this.waitingRoomService.initWaitingRoom();
    this.sessionService.subscribeToSessionEvents();
  }

  ngOnDestroy(): void {
    this.waitingRoomService.unsubscribeSocketEvents();
    this.sessionService.unsubscribeToSessionEvents();
  }

  get isOrganizer(): boolean {
    return this.waitingRoomService.me?.isOrganizer ?? false;
  }

  protected leaveGame(player: PlayerInformation): void {
    this.waitingRoomService.leaveGameSession(player.name);
  }

  protected startGame(): void {
    return;
  }


}