import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { GameNotification, GameNotificationKind } from '@common/game-notification';

@Component({
  selector: 'app-game-notifications-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-notifications-panel.component.html',
  styleUrl: './game-notifications-panel.component.scss',
})
export class GameNotificationsPanelComponent {
  @Input({ required: true }) notification: GameNotification | null = null;
  readonly systemTitle = 'Notification système';

  // Helper to identify critical notifications for styling.
  isCritical(notification: GameNotification): boolean {
    return notification.kind === GameNotificationKind.PlayerEliminated || notification.kind === GameNotificationKind.GameEnded;
  }

  // Helper to identify warning notifications for styling.
  isWarning(notification: GameNotification): boolean {
    return notification.kind === GameNotificationKind.PlayerSurrendered || notification.kind === GameNotificationKind.TurnTimedOut;
  }
}
