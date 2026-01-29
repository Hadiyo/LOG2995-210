import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { MapConfig } from '@app/interfaces/create-map-dialog';
import { AdminService } from '@app/services/admin.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, CreateMapDialogComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  constructor(private router: Router) {}
  protected isCreateDialogOpen = false;
  private adminService = inject(AdminService);

  /**
   * Calls adminService to set the map parameters for the editor view
   * Redirection to editor view
   * @param result MapConfig containing mapsize and mode
   */
  protected onCreateGameDialogConfirm(result: MapConfig): void {
    this.adminService.setMapProperties(result);
    this.toggleGameDialog();
    this.router.navigate(['/editor']);
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
}
