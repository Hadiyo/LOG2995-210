import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LocalCombatNotification } from '@app/config/game-session.config';
import { IncomingFlagTransferView } from '@app/pages/game-view-page/game-view-page.helpers.interfaces';

@Component({
  selector: 'app-game-view-overlays',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-view-overlays.component.html',
  styleUrl: './game-view-overlays.component.scss',
})
export class GameViewOverlaysComponent {
  @Input() matchEndMessage: string | null = null;
  @Input() endRedirectCountdownSeconds = 0;
  @Input() incomingFlagTransfer: IncomingFlagTransferView | null = null;
  @Input() combatNotifications: readonly LocalCombatNotification[] = [];

  @Output() acceptTransfer = new EventEmitter<void>();
  @Output() refuseTransfer = new EventEmitter<void>();
  @Output() dismissCombatNotification = new EventEmitter<string>();
}