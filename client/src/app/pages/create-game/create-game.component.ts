import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { EditorMap } from '@common/interface';

@Component({
  selector: 'app-create-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './create-game.component.html',
  styleUrl: './create-game.component.scss',
})
export class CreateGameComponent implements OnInit {
  // Liste des jeux qui seront affichés dans la vue
  games: EditorMap[] = [];

  constructor(
    private readonly gameService: GameService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.fetchVisibleGames();
  }

  /**
   * Récupère la liste des jeux et filtre ceux qui sont visibles 
   */
  private fetchVisibleGames(): void {
    this.gameService.getVisibleGames().subscribe({
      next: (games) => {

        this.games = games;
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des jeux :', err);
      }
    });
  }


  /**
   * Gère la sélection d'un jeu et redirige vers la création de personnage 
   * @param gameId L'identifiant du jeu choisi
   */
  selectGame(gameId: number): void {
    // Redirection vers la vue de création de personnage (Tâche #48) 
    this.router.navigate(['/create-character', gameId]);
  }
}