import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapStateService } from '@app/services/map/map-state.service';
import { ServiceState } from '@app/services/service-state.enum';
import { SessionService } from '@app/services/session/session.service';
import type { EditorMap } from '@common/maps/map.interface';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-create-game-page',
  standalone: true,
  imports: [GameCardComponent, BackButtonComponent, AsyncPipe],
  templateUrl: './create-game-page.component.html',
  styleUrl: './create-game-page.component.scss',
})
export class CreateGamePageComponent implements OnInit, OnDestroy {
  protected maps$: Observable<EditorMap[]> = this.mapStateService.maps$;
  protected errorMessage = '';

  constructor(
    private readonly mapStateService: MapStateService,
    private readonly sessionService: SessionService,
    private readonly router: Router,
  ) {}

  protected getMapState(): ServiceState {
    return this.mapStateService.state();
  }

  ngOnInit(): void {
    this.mapStateService.subscribeToMapEvents();
    this.sessionService.initGameSessionService();
  }

  ngOnDestroy(): void {
    this.mapStateService.unsubscribeFromMapEvents();
    this.sessionService.unsubscribeToSessionEvents();
  }

  /**
   * Sends a request to the server to create the game session and 
   * redirects to the character creation page
   * @param map 
   */
  onSelectMap(mapId: string): void {
    this.sessionService.createGameSession(mapId);
    this.router.navigate(['/character-creation'], {
      state: { context: 'create' },
    });
  }


}
