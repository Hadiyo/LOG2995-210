import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MatchStateService } from '@app/services/match/match-state.service';
import { MapStateService } from '@app/services/map/map-state.service';
import { ServiceState } from '@app/services/service-state.enum';
import type { MapSummary } from '@common/maps/map.interface';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-create-game-page',
  standalone: true,
  imports: [GameCardComponent, BackButtonComponent, AsyncPipe],
  templateUrl: './create-game-page.component.html',
  styleUrl: './create-game-page.component.scss',
})
export class CreateGamePageComponent implements OnInit, OnDestroy {
  protected maps$: Observable<MapSummary[]> = this.mapStateService.maps$;
  protected errorMessage = '';
  private readonly subscriptions = new Subscription();
  private availableMaps: MapSummary[] = [];

  constructor(
    private readonly mapStateService: MapStateService,
    private readonly matchStateService: MatchStateService,
    private readonly router: Router,
  ) {}

  protected getMapState(): ServiceState {
    return this.mapStateService.state();
  }

  ngOnInit(): void {
    this.mapStateService.subscribeToMapEvents();
    this.subscriptions.add(this.mapStateService.maps$.subscribe((maps) => {
      this.availableMaps = maps;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.mapStateService.unsubscribeFromMapEvents();
  }

  /**
   * Sends a request to the server to create the game session and
   * redirects to the character creation page
   * @param mapId
   */
  onSelectMap(mapId: string): void {
    const selectedMap = this.availableMaps.find((map) => map.id === mapId);
    if (!selectedMap) {
      this.errorMessage = 'Impossible de charger la carte selectionnee.';
      return;
    }

    this.matchStateService.selectMap(selectedMap);
    void this.router.navigate(['/character-creation']);
  }
}
