import { Component } from '@angular/core';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { CreateMapDialogResult } from '@app/interfaces/create-map-dialog';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, CreateMapDialogComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  isCreateDialogOpen = false;
  createMapDialogResult?: CreateMapDialogResult;

  openCreateMapDialog(): void {
    this.isCreateDialogOpen = true;
  }

  closeCreateMapDialog(): void {
    this.isCreateDialogOpen = false;
  }

  onCreateMapDialogConfirm(result: CreateMapDialogResult): void {
    this.createMapDialogResult = result;
    this.closeCreateMapDialog();
  }
}
