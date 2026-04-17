import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-game-view-turn-status-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-view-turn-status-overlay.component.html',
  styleUrl: './game-view-turn-status-overlay.component.scss',
})
export class GameViewTurnStatusOverlayComponent {
  @Input() canClose = true;
  @Input() headline = '';
  @Input() description = '';
  @Input() localPlayerStateLabel = '';
  @Input() localMovementCount = 0;
  @Input() localActionAvailable = false;
  @Input() movementFeedback: string | null = null;

  @Output() close = new EventEmitter<void>();
}