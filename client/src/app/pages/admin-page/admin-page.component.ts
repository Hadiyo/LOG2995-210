import { Component } from '@angular/core';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { CreateGameDialogComponent } from '@app/components/create-game-dialog/create-game-dialog.component';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppButtonComponent, CreateGameDialogComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  isCreateDialogOpen = false;

  openCreateGameDialog(): void {
    this.isCreateDialogOpen = true;
  }

  closeCreateGameDialog(): void {
    this.isCreateDialogOpen = false;
  }

  handleCreateGameDialog(): void {
    this.isCreateDialogOpen = false;
  }
}
