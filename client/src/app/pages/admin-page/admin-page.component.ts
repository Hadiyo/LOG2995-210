import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapConfig } from '@app/config/map.config';
import { AdminService } from '@app/services/admin.service';
import { MapStateService } from '@app/services/map/map-state.service';
import { ButtonVariant } from '@app/shared/ui/button.types';
import type { MapSummary } from '@common/maps/map.interface';
import { ServiceState } from '@app/services/service-state.enum';
import { Observable, take } from 'rxjs';

@Component({
  selector: 'app-admin-page',
  imports: [AppButtonComponent, CreateMapDialogComponent, GameCardComponent, AsyncPipe, BackButtonComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit, OnDestroy {
  protected readonly buttonVariant = ButtonVariant;
  protected maps$: Observable<MapSummary[]> = this.mapStateService.maps$;
  protected errorMessage: string = '';
  protected isCreateDialogOpen: boolean = false;
  protected isDeleteDialogOpen = false;
  protected isDeleting = false;
  protected mapPendingDeletion?: MapSummary;

  constructor(
    private readonly mapStateService: MapStateService,
    private readonly adminService: AdminService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.mapStateService.subscribeToMapEvents();
  }

  ngOnDestroy(): void {
    this.mapStateService.unsubscribeFromMapEvents();
  }

  protected toggleGameDialog(): void {
    this.isCreateDialogOpen = !this.isCreateDialogOpen;
  }

  protected mapState(): ServiceState {
    return this.mapStateService.state();
  }

  /**
   * Sends a signal to editor view to create a new map and display it in editor view
   * @param result GameMode and MapSize
   */
  protected onCreateGameDialogConfirm(result: MapConfig): void {
    const mapPropertiesSet = this.adminService.setMapProperties(result);
    if (mapPropertiesSet) {
      this.toggleGameDialog();
      this.router.navigate(['/editor']);
    } else {
      this.errorMessage = "Impossible d'aller rechercher la carte.";
    }
  }

  /**
   * Sends the mapId to the AdminService to make the proper API calls
   * to retrieve the given map for edition
   * @param mapId id of the map to retrieve for the editor view
   */
  protected onEditExistingMap(map: MapSummary): void {
    this.adminService
      .fetchExistingMapForEditor(map.id)
      .pipe(take(1))
      .subscribe((editorMapLoaded) => {
        if (editorMapLoaded) this.router.navigate(['/editor']);
        else this.errorMessage = "Impossible d'aller rechercher la carte.";
      });
  }

  protected onDeleteMap(map: MapSummary): void {
    this.mapPendingDeletion = map;
    this.isDeleteDialogOpen = true;
  }

  protected confirmDeleteMap(): void {
    const map = this.mapPendingDeletion;
    if (!map || this.isDeleting) return;

    this.isDeleting = true;
    this.errorMessage = '';

    this.mapStateService.deleteMap(map).subscribe({
      next: () => this.resetDeleteDialog(),
      error: () => {
        this.errorMessage = 'Impossible de supprimer la carte pour le moment.';
      },
    });
  }

  protected closeDeleteDialog(): void {
    if (this.isDeleting) return;
    this.resetDeleteDialog();
  }

  protected onToggleVisibility(map: MapSummary): void {
    this.mapStateService.toggleMapVisibility(map);
    if (this.mapStateService.state() === ServiceState.Error)
      this.errorMessage = 'Impossible de modifier la visibilite pour le moment.';
  }

  private resetDeleteDialog(): void {
    this.isDeleteDialogOpen = false;
    this.isDeleting = false;
    this.mapPendingDeletion = undefined;
  }
}
