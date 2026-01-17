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
      label: 'Creer une partie',
      link: '/game',
      variant: 'primary',
      disabled: false,
    },
    {
      label: 'Joindre une partie',
      link: '/material',
      variant: 'secondary',
      disabled: false,
    },
    {
      label: 'Administrer les jeux',
      variant: 'ghost',
      disabled: true,
    },
  ];
}
