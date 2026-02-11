import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapLoadState } from '@app/services/map/map-state.enum';
import { MapStateService } from '@app/services/map/map-state.service';
import type { EditorMap } from '@common/interface';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-create-game-page',
  standalone: true,
  imports: [GameCardComponent, RouterLink, AsyncPipe],
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

  onMapClick(map: EditorMap): EditorMap {
    // TODO: Save game map in interface
    this.router.navigate(['/character-creation']);
    return map;
  }

}
