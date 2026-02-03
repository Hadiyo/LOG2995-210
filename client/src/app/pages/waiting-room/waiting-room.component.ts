import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [], // Ajoutez vos composants UI ici (ex: PlayArea si besoin, mais probablement non)
  templateUrl: './waiting-room.component.html',
  styleUrls: ['./waiting-room.component.scss']
})
export class WaitingRoomComponent {
  // Mock des joueurs pour le Sprint 1 (Sans Socket)
  players = [
    { name: 'Organisateur (Vous)', avatar: 'assets/avatars/avatar1.png', isOrganizer: true },
    { name: 'Joueur 2', avatar: 'assets/avatars/avatar2.png', isOrganizer: false }
  ];

  constructor(private router: Router) {}

  // "Le système permet un retour vers la vue initiale"
  quitGame(): void {
    this.router.navigate(['/home']);
  }

  // Cette fonction ne fera rien de réel pour l'instant (Sprint 2+)
  startGame(): void {
    console.log('Lancement de la partie (Logique future)');
    // this.router.navigate(['/game']);
  }
}