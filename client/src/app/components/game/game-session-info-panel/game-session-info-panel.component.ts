import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

const COLOR_CHANNEL_MAX = 255;
const HALF_RATIO = 0.5;

@Component({
  selector: 'app-game-session-info-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-session-info-panel.component.html',
  styleUrl: './game-session-info-panel.component.scss',
})
export class GameSessionInfoPanelComponent {
  @Input({ required: true }) cols = 1;
  @Input({ required: true }) rows = 1;
  @Input({ required: true }) currentPlayers = 0;
  @Input({ required: true }) maxPlayers = 0;
  @Input({ required: true }) remainingSeconds = 0;
  @Input() totalSeconds = 30;
  @Input() highlightTimer = true;
  @Input() activePlayerName: string | null = null;
  @Input() defaultPanelTitle = 'N/A';

  // Computes timer color based on remaining time ratio, transitioning from green to red.
  get timerColor(): string {
    const total = Math.max(1, this.totalSeconds);
    const clampedRemaining = Math.max(0, Math.min(this.remainingSeconds, total));
    const ratio = clampedRemaining / total;

    if (ratio >= HALF_RATIO) {
      const highRangeRatio = (ratio - HALF_RATIO) / HALF_RATIO;
      const red = Math.round(COLOR_CHANNEL_MAX * (1 - highRangeRatio));
      return `rgb(${red}, ${COLOR_CHANNEL_MAX}, 0)`;
    }

    const lowRangeRatio = ratio / HALF_RATIO;
    const green = Math.round(COLOR_CHANNEL_MAX * lowRangeRatio);
    return `rgb(${COLOR_CHANNEL_MAX}, ${green}, 0)`;
  }
}
