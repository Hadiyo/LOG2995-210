import { AsyncPipe } from '@angular/common';
import { Component, computed, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { JoinGameCardComponent } from '@app/components/join-game-card/join-game-card.component';
import { ServiceState } from '@app/services/service-state.enum';
import { SessionService } from '@app/services/session/session.service';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-join-game',
  imports: [BackButtonComponent, AsyncPipe, JoinGameCardComponent],
  templateUrl: './join-game.component.html',
  styleUrl: './join-game.component.scss',
})
export class JoinGameComponent implements OnInit, OnDestroy {
  constructor(private readonly sessionService: SessionService, 
              private readonly router: Router,
              private snackBar: MatSnackBar) {}

  protected availableSessions$: Observable<GameSessionPreview[]> = this.sessionService.sessionsPreview$;
  protected isLoading = computed(() => this.sessionService.state() === ServiceState.Loading);

  ngOnInit(): void {
    this.sessionService.initGameSessionService();
  }

  ngOnDestroy(): void {
    this.sessionService.unsubscribeToSessionEvents();
  }

  onSelectedSession(previewId: string): void {
    this.sessionService.setPreviewId(previewId);
    this.sessionService.setContext('join');
    this.router.navigate(['/character-creation']).then(success => {
      if(success)
        this.sessionService.joinSession(previewId);
      else {
          this.snackBar.open('Impossible de naviguer vers la création de personnage', 'Fermer', {
          duration: 3000, 
          panelClass: ['error-snackbar'], 
        });
      }
    });
    
  }
}
