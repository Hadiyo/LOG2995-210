import { Component } from '@angular/core';
import { AppButtonComponent } from '@app/components/app-button/app-button.component';
import { NameSliderComponent } from '@app/components/name-slider/name-slider.component';

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
  imports: [AppButtonComponent, NameSliderComponent],
  standalone: true,
})
export class MainPageComponent {
  readonly title: string = 'LOG2995';
  readonly actions: readonly {
    id: 'create-game' | 'join-game' | 'admin-game';
    label: string;
    variant: 'primary' | 'secondary' | 'tertiary' | 'ghost';
    link?: string;
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
      variant: 'tertiary',
    },
  ];

  readonly teamNames = [
    'Nadim',
    'Wei',
    'Hadi',
    'Ariane',
    'Thong',
  ];
}
