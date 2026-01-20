import { Component } from '@angular/core';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';

@Component({
  selector: 'app-main-actions',
  standalone: true,
  imports: [AppButtonComponent],
  templateUrl: './main-actions.component.html',
  styleUrl: './main-actions.component.scss',
})
export class MainActionsComponent {
  readonly actions: readonly {
    id: 'create-game' | 'join-game' | 'admin-game';
    label: string;
    variant: 'primary' | 'secondary' | 'ghost';
    link?: string;
    disabled?: boolean;
  }[] = [
    {
      id: 'create-game',
      label: 'CREER UNE PARTIE',
      link: '/game',
      variant: 'primary',
    },
    {
      id: 'join-game',
      label: 'JOINDRE UNE PARTIE',
      link: '/material',
      variant: 'secondary',
    },
    {
      id: 'admin-game',
      label: 'ADMINISTRER LES JEUX',
      variant: 'ghost',
      disabled: true,
    },
  ];
}
