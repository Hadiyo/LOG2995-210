import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { GameSessionActionContext } from '@app/config/game-session.config';
import { GameSessionDisplayService } from '@app/services/game-view/game-session-display.service';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { MatchPlayer, MatchSanctuaryChoice } from '@common/game/match.interface';
import { ObjectType } from '@common/maps/map.enums';

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

type SanctuaryType = 'regen' | 'combat';

interface SanctuaryResolveContext {
  attackBonus: number;
  defenseBonus: number;
  health: number;
  playerId: string;
  sanctuaryType: SanctuaryType;
}

const SANCTUARY_ACTION_LABELS = {
  normal: 'Normal',
  doubleOrNothing: 'Double ou rien',
  cancel: 'Annuler',
} as const;

@Component({
  selector: 'app-game-map-action-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-map-action-prompt.component.html',
  styleUrl: './game-map-action-prompt.component.scss',
})
export class GameMapActionPromptComponent implements OnDestroy {
  private static readonly sanctuaryDoubleRevealDelayMs = 850;
  private static readonly sanctuaryDoublePendingLabel = '...';
  private readonly interaction = inject(GameSessionInteractionService);
  private readonly display = inject(GameSessionDisplayService);
  private sanctuaryChoiceTimeoutId: number | null = null;
  private sanctuaryRevealTitle: string | null = null;
  private sanctuaryRevealMessage = '';
  private sanctuaryResolveContext: SanctuaryResolveContext | null = null;
  readonly sanctuaryChoicePending = signal(false);
  readonly doubleOrNothingRevealLabel = signal<string | null>(null);

  constructor() {
    effect(
      () => {
        if (this.interaction.hasLocalPendingSanctuaryChoice() || this.sanctuaryChoicePending()) {
          return;
        }

        this.doubleOrNothingRevealLabel.set(null);
        this.sanctuaryResolveContext = null;
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const currentMatch = this.display.match();
        if (!currentMatch || !this.sanctuaryChoicePending() || !this.sanctuaryResolveContext) {
          return;
        }

        const resolveContext = this.sanctuaryResolveContext;
        if (currentMatch.pendingSanctuaryChoice?.playerId === resolveContext.playerId) {
          return;
        }

        const updatedPlayer = currentMatch.players.find((player) => player.id === resolveContext.playerId) ?? null;
        if (!updatedPlayer) {
          return;
        }

        this.doubleOrNothingRevealLabel.set(this.resolveActualOutcomeLabel(resolveContext, updatedPlayer));
      },
      { allowSignalWrites: true },
    );
  }

  readonly prompt = computed<GameMapPromptState | null>(() => {
    if (this.interaction.hasLocalPendingSanctuaryChoice() || this.sanctuaryChoicePending()) {
      const hasPendingChoice = this.interaction.hasLocalPendingSanctuaryChoice();
      const sanctuaryTitle = hasPendingChoice ? this.interaction.sanctuaryPromptTitle() : this.sanctuaryRevealTitle;
      const sanctuaryMessage = hasPendingChoice ? this.interaction.sanctuaryPromptText() : this.sanctuaryRevealMessage;

      return {
        variant: 'sanctuary',
        title: sanctuaryTitle,
        message: sanctuaryMessage,
        actions: [
          { id: 'normal', label: SANCTUARY_ACTION_LABELS.normal },
          { id: 'double-or-nothing', label: SANCTUARY_ACTION_LABELS.doubleOrNothing },
          { id: 'cancel', label: SANCTUARY_ACTION_LABELS.cancel },
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
    if (this.isActionDisabled(actionId)) {
      return;
    }

    if (actionId === 'double-or-nothing') {
      this.startDoubleOrNothingReveal();
      return;
    }

    if (actionId === 'normal' || actionId === 'cancel') {
      this.interaction.resolveSanctuaryChoice(actionId);
      return;
    }

    this.interaction.selectActionContext(actionId);
  }

  actionLabel(action: GameMapPromptAction): string {
    if (action.id === 'double-or-nothing' && this.doubleOrNothingRevealLabel()) {
      return this.doubleOrNothingRevealLabel() ?? action.label;
    }

    return action.label;
  }

  isDoubleOrNothingAction(actionId: GameMapPromptActionId): boolean {
    return actionId === 'double-or-nothing';
  }

  isActionDisabled(actionId: GameMapPromptActionId): boolean {
    const isSanctuaryAction = actionId === 'normal' || actionId === 'double-or-nothing' || actionId === 'cancel';
    return isSanctuaryAction && this.sanctuaryChoicePending();
  }

  ngOnDestroy(): void {
    this.interaction.setSanctuaryPromptUiHold(false);
    this.clearSanctuaryChoiceTimeout();
  }

  private startDoubleOrNothingReveal(): void {
    if (!this.interaction.hasLocalPendingSanctuaryChoice()) {
      return;
    }

    const localPlayer = this.display.findPlayerById(this.display.localPlayer()?.id ?? null);
    const sanctuaryType = this.getPendingSanctuaryType();
    if (!localPlayer || !sanctuaryType) {
      return;
    }

    this.clearSanctuaryChoiceTimeout();
    this.sanctuaryRevealTitle = this.interaction.sanctuaryPromptTitle();
    this.sanctuaryRevealMessage = this.interaction.sanctuaryPromptText();
    this.sanctuaryResolveContext = {
      playerId: localPlayer.id,
      sanctuaryType,
      health: localPlayer.health,
      attackBonus: localPlayer.attackBonus ?? 0,
      defenseBonus: localPlayer.defenseBonus ?? 0,
    };
    this.sanctuaryChoicePending.set(true);
    this.interaction.setSanctuaryPromptUiHold(true);
    this.doubleOrNothingRevealLabel.set(GameMapActionPromptComponent.sanctuaryDoublePendingLabel);
    this.interaction.resolveSanctuaryChoice('double-or-nothing');

    this.sanctuaryChoiceTimeoutId = window.setTimeout(() => {
      this.sanctuaryChoicePending.set(false);
      this.interaction.setSanctuaryPromptUiHold(false);
      this.sanctuaryRevealTitle = null;
      this.sanctuaryRevealMessage = '';
      this.sanctuaryResolveContext = null;
    }, GameMapActionPromptComponent.sanctuaryDoubleRevealDelayMs);
  }

  private clearSanctuaryChoiceTimeout(): void {
    if (this.sanctuaryChoiceTimeoutId !== null) {
      window.clearTimeout(this.sanctuaryChoiceTimeoutId);
      this.sanctuaryChoiceTimeoutId = null;
    }
  }

  private getPendingSanctuaryType(): SanctuaryType | null {
    const currentMatch = this.display.match();
    const pendingChoice = currentMatch?.pendingSanctuaryChoice;
    if (!currentMatch || !pendingChoice) {
      return null;
    }

    const pendingObject = currentMatch.allObjects.find((candidate) => candidate.id === pendingChoice.objectId) ?? null;
    if (!pendingObject) {
      return null;
    }

    if (pendingObject.type === ObjectType.REGEN) {
      return 'regen';
    }

    if (pendingObject.type === ObjectType.ARENA) {
      return 'combat';
    }

    return null;
  }

  private resolveActualOutcomeLabel(context: SanctuaryResolveContext, player: MatchPlayer): string {
    if (context.sanctuaryType === 'regen') {
      return player.health > context.health ? 'Double !' : 'Rien...';
    }

    const attackBonusGain = (player.attackBonus ?? 0) - context.attackBonus;
    const defenseBonusGain = (player.defenseBonus ?? 0) - context.defenseBonus;
    return attackBonusGain > 0 || defenseBonusGain > 0 ? 'Double !' : 'Rien...';
  }
}
