import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateGameDialogComponent } from '@app/components/create-game-dialog/create-game-dialog.component';
import { MapConfig } from '@app/interfaces/create-game-dialog';
import { AdminStateService } from '@app/services/admin-state.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, CreateGameDialogComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  constructor(private router: Router) {}
  protected isCreateDialogOpen = false;
  private adminStateService = inject(AdminStateService);

  protected onCreateGameDialogConfirm(result: MapConfig): void {
    this.adminStateService.setMapProperties(result);
    this.toggleGameDialog();
    this.router.navigate(['/editor']);
  }

  protected toggleGameDialog(): void {
    this.isCreateDialogOpen = !this.isCreateDialogOpen;
  }
}
