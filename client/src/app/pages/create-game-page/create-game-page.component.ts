import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapService } from '@app/services/map.service';
import type { EditorMap } from '@common/interface';
import { Subject, catchError, of, switchMap, takeUntil, tap, timer } from 'rxjs';

@Component({
  selector: 'app-create-game-page',
  standalone: true,
  imports: [GameCardComponent, RouterLink],
  templateUrl: './create-game-page.component.html',
  styleUrl: './create-game-page.component.scss',
})
export class CreateGamePageComponent implements OnInit, OnDestroy {
  protected maps: EditorMap[] = [];
  protected isLoading = false;
  protected errorMessage = '';

  private readonly destroy$ = new Subject<void>();
  private readonly refreshMs = 5000;

  constructor(
    private readonly mapService: MapService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    timer(0, this.refreshMs)
      .pipe(
        switchMap(() => {
          this.errorMessage = '';
          return this.mapService.getVisibleMaps().pipe(
            catchError(() => {
              this.errorMessage = 'Impossible de charger les parties pour le moment.';
              return of([] as EditorMap[]);
            }),
          );
        }),
        tap(() => {
          this.isLoading = false;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((maps) => {
        this.maps = maps;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSelectMap(map: EditorMap): void {
    void map;
    this.router.navigate(['/character-creation']);
  }

}
