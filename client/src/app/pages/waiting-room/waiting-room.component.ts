import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '@app/services/session/session.service';

interface WaitingPlayer {
  name: string;
  avatar: string;
  isOrganizer: boolean;
}

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule], // pour le ngIf
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent implements OnInit, OnDestroy {
  players: WaitingPlayer[] = [];

  constructor(private router: Router, private sessionService: SessionService) {}

  ngOnInit() {
    this.sessionService.initGameSessionService();
  }

  ngOnDestroy(): void {
    this.sessionService.unsubscribeToSessionEvents();
  }

  quitGame(): void {
    this.router.navigate(['/home']);
  }
}