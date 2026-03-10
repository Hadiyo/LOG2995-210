import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-game-action-bar',
  standalone: true,
  imports: [],
  templateUrl: './game-action-bar.component.html',
  styleUrl: './game-action-bar.component.scss',
})
export class GameActionBarComponent {
  @Input() actionModeEnabled = false;
  @Input() canAct = true;
  @Input() canUseActionMode = true;
  @Output() endTurn = new EventEmitter<void>();
  @Output() toggleActionMode = new EventEmitter<void>();
  @Output() surrender = new EventEmitter<void>();
}
