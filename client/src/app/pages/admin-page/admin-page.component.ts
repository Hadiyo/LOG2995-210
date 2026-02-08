import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapConfig } from '@app/interfaces/create-map-dialog';
import { AdminService } from '@app/services/admin.service';
import { MapApiService } from '@app/services/map/map-api.service';
import type { EditorMap } from '@common/interface';
import { take } from 'rxjs';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, CreateMapDialogComponent, GameCardComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit {
  protected maps: EditorMap[] = [];
  protected isLoading: boolean = false;
  protected errorMessage: string = '';
  protected isCreateDialogOpen: boolean = false;

  constructor(
    private readonly mapService: MapApiService,
    private readonly adminService: AdminService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMaps();
  }

  /**
   * Opens or closes the dialog box to create a new map
   */
  protected toggleGameDialog(): void {
    this.isCreateDialogOpen = !this.isCreateDialogOpen;
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
    } else this.errorMessage = "Impossible d'aller rechercher la carte.";
  }

  /**
   * Sends the mapId to the AdminService to make the proper API calls
   * to retrieve the given map for edition
   * @param mapId id of the map to retrieve for the editor view
   */
  protected onEditExistingMap(map: EditorMap): void {
    this.adminService.fetchExistingMapForEditor(map.id)
      .pipe(take(1))
      .subscribe(ok => {
        if (ok) this.router.navigate(['/editor']);
        else this.errorMessage = "Impossible d'aller rechercher la carte.";
      });
  }

  /**
   * Manages AdminPage response to Map HTTP DELETE by subscription
   * @param map 
   * @returns void
   */
  protected onDeleteMap(map: EditorMap): void {
    if (!window.confirm(`Supprimer la carte "${map.name}" ?`)) return;

    this.mapService.deleteMap(map.id).subscribe({
      next: () => {
        this.maps = this.maps.filter((item) => item.id !== map.id);
      },
      error: () => {
        this.errorMessage = 'Impossible de supprimer la carte pour le moment.';
      },
    });
  }

  /**
   * Manages AdminPage response to Map HTTP PATCH by subscription
   * @param map 
   */
  protected onToggleVisibility(map: EditorMap): void {
    this.mapService.updateMapVisibility(map.id, !map.visibility).subscribe({
      next: (updated) => {
        this.maps = this.maps.map((item) => (item.id === updated.id ? updated : item));
      },
      error: () => {
        this.errorMessage = 'Impossible de modifier la visibilite pour le moment.';
      },
    });
  }

  /**
   * Manages AdminPage response to HTTP GET all database maps by subscription:
   */
  private loadMaps(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.mapService.getAllMaps().subscribe({
      next: (maps) => {
        this.maps = maps;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les cartes pour le moment.';
        this.isLoading = false;
      },
    });
  }
}
