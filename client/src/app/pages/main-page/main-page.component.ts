import { Component } from '@angular/core';
import { MainActionsComponent } from '@app/components/main-actions/main-actions.component';
import { NameSliderComponent } from '@app/components/name-slider/name-slider.component';

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
  imports: [MainActionsComponent, NameSliderComponent],
  standalone: true,
})
export class MainPageComponent {
  readonly title: string = 'LOG2995';

  readonly teamNames = [
    'Nadim',
    'Wei',
    'Hadi',
    'Ariane',
    'Thong',
  ];
}
