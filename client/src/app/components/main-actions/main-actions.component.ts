import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-main-actions',
  imports: [RouterLink],
  templateUrl: './main-actions.component.html',
  styleUrl: './main-actions.component.scss',
  standalone: true,
})
export class MainActionsComponent {
  actions = [
    {
      id:'create-game',
      label: 'Creer une partie',
      link: '/game',
      variant: 'primary',
      disabled: false,
    },
    {
      id:'join-game',
      label: 'Joindre une partie',
      link: '/material',
      variant: 'secondary',
      disabled: false,
    },
    {
      id:'admin-game',
      label: 'Administrer les jeux',
      variant: 'ghost',
      disabled: true,
    },
  ];
}
