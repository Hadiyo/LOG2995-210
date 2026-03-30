import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameSessionActionContext } from '@app/config/game-session.config';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { MatchSanctuaryChoice } from '@common/game/match.interface';

type GameMapPromptActionId = GameSessionActionContext | MatchSanctuaryChoice;

interface GameMapPromptAction {
  id: GameMapPromptActionId;
  label: string;
}

interface GameMapPromptState {
  actions: readonly GameMapPromptAction[];
  message: string;
  title: string | null;
  variant: 'action-select' | 'sanctuary';
}

@Component({
  selector: 'app-game-map-action-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-map-action-prompt.component.html',
  styleUrl: './game-map-action-prompt.component.scss',
})
export class GameMapActionPromptComponent {
  private readonly interaction = inject(GameSessionInteractionService);

  readonly prompt = computed<GameMapPromptState | null>(() => {
    if (this.interaction.hasLocalPendingSanctuaryChoice()) {
      return {
        variant: 'sanctuary',
        title: this.interaction.sanctuaryPromptTitle(),
        message: this.interaction.sanctuaryPromptText(),
        actions: [
          { id: 'normal', label: 'Normal' },
          { id: 'double-or-nothing', label: 'Double ou rien' },
          { id: 'cancel', label: 'Annuler' },
        ],
      };
    }

    if (!this.interaction.actionSelectionOpen()) {
      return null;
    }

    return {
      variant: 'action-select',
      title: null,
      message: 'Choisissez une action pour ce tour.',
      actions: this.interaction.availableActionContexts().map((option) => ({
        id: option.context,
        label: option.label,
      })),
    };
  });

  onSelect(actionId: GameMapPromptActionId): void {
    if (actionId === 'normal' || actionId === 'double-or-nothing' || actionId === 'cancel') {
      this.interaction.resolveSanctuaryChoice(actionId);
      return;
    }

    this.interaction.selectActionContext(actionId);
  }
}
