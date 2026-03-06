import { AsyncPipe } from '@angular/common';
import { Component, computed, OnDestroy, OnInit } from '@angular/core';
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
  constructor(private readonly sessionService: SessionService, private router: Router) {}

  protected sessions$: Observable<GameSessionPreview[]> = this.sessionService.sessionsPreview$;
  protected isLoading = computed(() => this.sessionService.state() === ServiceState.Loading);

  ngOnInit(): void {
    this.sessionService.initGameSessionService();
  }

  ngOnDestroy(): void {
    this.sessionService.unsubscribeToSessionEvents();
  }

  onSelectedSession(sessionId: string): void {
    // ADD PLAYER TO SESSION RIGHT AWAY TO SAVE THE SPOT
    this.sessionService.joinGameSession(sessionId);
    // REDIRECTION TO CREATE CHARACTER PAGE
    this.router.navigate(['character-creation']);
  }
}
