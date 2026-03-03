import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapLoadState } from '@app/services/map/map-state.enum';
import { MapStateService } from '@app/services/map/map-state.service';
import type { EditorMap } from '@common/maps/map.interface';
import { Observable } from 'rxjs';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';

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
    private readonly router: Router,
  ) {}

  protected getMapState(): MapLoadState {
    return this.mapStateService.state();
  }

  ngOnInit(): void {
    this.mapStateService.subscribeToMapEvents();
  }

  ngOnDestroy(): void {
    this.mapStateService.unsubscribeFromMapEvents();
  }

  onSelectMap(map: EditorMap): void {
    void map;
    this.router.navigate(['/character-creation']);
  }


}
