import { AsyncPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapConfig } from '@app/interfaces/create-map-dialog';
import { AdminService } from '@app/services/admin.service';
import { MapLoadState } from '@app/services/map/map-state.enum';
import { MapStateService } from '@app/services/map/map-state.service';
import type { EditorMap } from '@common/interface';
import { Observable, take } from 'rxjs';

@Component({
  selector: 'app-admin-page',
  imports: [AppButtonComponent, CreateMapDialogComponent, GameCardComponent, AsyncPipe, RouterLink],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit {
  protected maps$: Observable<EditorMap[]> = this.mapStateService.maps$;
  protected errorMessage: string = '';
  protected isCreateDialogOpen: boolean = false;
  protected isDeleteDialogOpen = false; // Delete map popup state
  protected isDeleting = false;  // Delete button state
  protected mapPendingDeletion?: EditorMap;

  constructor(
    private readonly mapStateService: MapStateService,
    private readonly adminService: AdminService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMaps();
  }

  protected toggleGameDialog(): void {
    this.isCreateDialogOpen = !this.isCreateDialogOpen;
  }

  protected mapState(): MapLoadState {
    return this.mapStateService.state();
  }

  /**
   * Sends a signal to editor view to create a new map and display it in editor view
   * @param result GameMode and MapSize
   */
  protected onCreateGameDialogConfirm(result: MapConfig): void {
    const ok = this.adminService.setMapProperties(result);
    if (ok) {
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
  protected onEditExistingMap(map: EditorMap): void {
    this.adminService
      .fetchExistingMapForEditor(map.id)
      .pipe(take(1))
      .subscribe(ok => {
        if (ok === true) this.router.navigate(['/editor']);
        else this.errorMessage = "Impossible d'aller rechercher la carte.";
      });
  }


  protected onDeleteMap(map: EditorMap): void {
    this.mapPendingDeletion = map;
    this.isDeleteDialogOpen = true;
  }

  protected confirmDeleteMap(): void {
    const map = this.mapPendingDeletion;
    if (!map || this.isDeleting) return;

    this.isDeleting = true;
    this.errorMessage = '';

    this.mapStateService.deleteMap(map);
    if (this.mapStateService.state() === MapLoadState.Error) {
      this.errorMessage = 'Impossible de supprimer la carte pour le moment.';
      this.isDeleting = false;
      this.isDeleteDialogOpen = false;
      this.mapPendingDeletion = undefined;
    } else {
      this.resetDeleteDialog();
    }
  }

  protected closeDeleteDialog(): void {
    if (this.isDeleting) return;
    this.resetDeleteDialog();
  }

  protected onToggleVisibility(map: EditorMap): void {
    this.mapStateService.toggleMapVisibility(map);
    if (this.mapStateService.state() === MapLoadState.Error)
      this.errorMessage = 'Impossible de modifier la visibilite pour le moment.';
  }


  private loadMaps(): void {
    this.errorMessage = '';
    this.mapStateService.loadMaps();
    if (this.mapStateService.state() === MapLoadState.Error)
      this.errorMessage = 'Impossible de charger les cartes pour le moment.';
  }

  private resetDeleteDialog(): void {
    this.isDeleteDialogOpen = false;
    this.isDeleting = false;
    this.mapPendingDeletion = undefined;
  }
}
