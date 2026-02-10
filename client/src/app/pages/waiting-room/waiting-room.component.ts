import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface WaitingPlayer {
  name: string;
  avatar: string;
  isOrganizer: boolean;
}

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [CommonModule], // pour le ngIf
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss'],
})
export class WaitingRoomComponent {
  players: WaitingPlayer[] = [];

  constructor(private router: Router) {}

  quitGame(): void {
    this.router.navigate(['/home']);
  }
}