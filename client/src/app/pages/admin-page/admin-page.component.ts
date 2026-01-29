import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { MapConfig } from '@app/interfaces/create-map-dialog';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { MapService } from '@app/services/map.service';
import type { EditorMap } from '@common/interface';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, CreateMapDialogComponent, GameCardComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit {
  isCreateDialogOpen = false;
  createMapDialogResult?: CreateMapDialogResult;
  maps: EditorMap[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly mapService: MapService,
    private readonly editorState: EditorStateService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMaps();
  }

  protected onCreateGameDialogConfirm(result: MapConfig): void {
    this.adminService.setMapProperties(result);
    this.toggleGameDialog();
    this.router.navigate(['/editor']);
  }

  /**
 * Sends the mapId to the AdminService to make the proper API calls
 * to retrieve the given map for edition
 * @param mapId id of the map to retrieve for the editor view
 */
  protected onEditExistingMap(mapId: string): void {
    this.adminService.fetchExistingMapForEditor(mapId);
    this.router.navigate(['./editor']);
  }
  /**
   * Opens or closes the dialog box
   */
  protected toggleGameDialog(): void {
    this.isCreateDialogOpen = !this.isCreateDialogOpen;
  }

  /**
   * Sends the mapId to the AdminService to make the proper API calls
   * to retrieve the given map for edition
   * @param mapId id of the map to retrieve for the editor view
   */
  protected onEditExistingMap(mapId: string): void {
    this.adminService.fetchExistingMapForEditor(mapId);
    this.router.navigate(['./editor']);
  }

  onEditMap(map: EditorMap): void {
    this.editorState.loadMap(map);
    this.router.navigate(['/editor']);
  }

  onDeleteMap(map: EditorMap): void {
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

  onToggleVisibility(map: EditorMap): void {
    this.mapService.updateMapVisibility(map.id, !map.visibility).subscribe({
      next: (updated) => {
        this.maps = this.maps.map((item) => (item.id === updated.id ? updated : item));
      },
      error: () => {
        this.errorMessage = 'Impossible de modifier la visibilite pour le moment.';
      },
    });
  }

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

  onEditMap(map: EditorMap): void {
    this.editorState.loadMap(map);
    this.router.navigate(['/editor']);
  }

  onDeleteMap(map: EditorMap): void {
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

  onToggleVisibility(map: EditorMap): void {
    this.mapService.updateMapVisibility(map.id, !map.visibility).subscribe({
      next: (updated) => {
        this.maps = this.maps.map((item) => (item.id === updated.id ? updated : item));
      },
      error: () => {
        this.errorMessage = 'Impossible de modifier la visibilite pour le moment.';
      },
    });
  }

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
