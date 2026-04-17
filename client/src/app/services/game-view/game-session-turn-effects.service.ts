import { effect, inject, Injectable } from '@angular/core';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { CombatStateService } from '@app/services/match/combat-state.service';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameSessionDisplayService } from './game-session-display.service';
import { GameSessionInteractionService } from './game-session-interaction.service';

@Injectable()
export class GameSessionTurnEffectsService {
    private readonly combatStateService = inject(CombatStateService);
    private readonly display = inject(GameSessionDisplayService);
    private readonly gameSessionSocket = inject(GameSessionSocketService);
    private readonly interaction = inject(GameSessionInteractionService);

    private previousObservedPhase: MatchTurnState['phase'] | null = null;
    private previousObservedActivePlayerId: string | null = null;
    private previousObservedTurnIndex: number | null = null;
    private lastAutoEndedTurnKey: string | null = null;

    constructor() {
        effect(() => {
            if (this.display.matchEndState() && this.interaction.inspectedTile()) {
                this.interaction.closeInspection();
            }
        });
        effect(() => {
            if (this.interaction.actionContext() && (!this.interaction.canUseAction() || this.interaction.actionTargets().size === 0)) {
                this.interaction.clearActionSelection();
            }
        });
        effect(() => {
            if (this.interaction.actionSelectionOpen() && this.interaction.availableActionContexts().length === 0) {
                this.interaction.actionSelectionOpen.set(false);
            }
        });
        effect(() => {
            this.observeTurnProgression(this.display.turnState());
        });
        effect(() => {
            this.handleAutoTurnEnd();
        });
    }
    private observeTurnProgression(currentTurnState: MatchTurnState | null): void {
        const sameActiveTurn = currentTurnState?.phase === 'active' &&
            currentTurnState.activePlayerId === this.previousObservedActivePlayerId &&
            currentTurnState.currentTurnIndex === this.previousObservedTurnIndex;
        const completedPlayerId = this.previousObservedPhase === 'active' ? this.previousObservedActivePlayerId : null;

        if (completedPlayerId && !sameActiveTurn) {
            this.handleCompletedTurn();
        }

        this.previousObservedPhase = currentTurnState?.phase ?? null;
        this.previousObservedActivePlayerId = currentTurnState?.activePlayerId ?? null;
        this.previousObservedTurnIndex = currentTurnState?.currentTurnIndex ?? null;
    }

    private handleAutoTurnEnd(): void {
        const currentMatch = this.display.match();
        const currentTurnState = this.display.turnState();
        if (!this.shouldEvaluateAutoTurnEnd(currentMatch, currentTurnState) || !currentTurnState) {
            this.lastAutoEndedTurnKey = null;
            return;
        }

        if (this.combatStateService.hasActiveCombat()) {
            this.lastAutoEndedTurnKey = null;
            return;
        }

        if (this.interaction.hasLocalPendingSanctuaryChoice()) {
            this.lastAutoEndedTurnKey = null;
            return;
        }

        const activePlayer = this.display.findPlayerById(currentTurnState.activePlayerId);
        const localPlayerId = this.display.localPlayer()?.id ?? null;
        if (!activePlayer || localPlayerId !== activePlayer.id || this.hasRemainingTurnOptions(activePlayer, currentTurnState)) {
            this.lastAutoEndedTurnKey = null;
            return;
        }

        const autoEndKey = this.buildAutoEndKey(currentTurnState, activePlayer);
        if (this.lastAutoEndedTurnKey === autoEndKey) {
            return;
        }

        this.lastAutoEndedTurnKey = autoEndKey;
        this.gameSessionSocket.endTurn(activePlayer.id);
        this.interaction.clearActionSelection();
        this.interaction.closeInspection();
        this.interaction.movementFeedback.set(
            `Tour termine automatiquement pour ${activePlayer.name}: aucune interaction possible.`,
        );
    }

    private shouldEvaluateAutoTurnEnd(
        currentMatch: InitializedMatch | null,
        currentTurnState: MatchTurnState | null,
    ): boolean {
        return !!currentMatch &&
            !currentMatch.endState &&
            !currentMatch.pendingFlagTransfer &&
            !!currentTurnState &&
            currentTurnState.phase === 'active' &&
            !!currentTurnState.activePlayerId;
    }

    private hasRemainingTurnOptions(activePlayer: MatchPlayer, currentTurnState: MatchTurnState): boolean {
        const hasMovementOption = currentTurnState.movementPointsRemaining > 0 &&
            this.interaction.hasAvailableMovement(activePlayer, currentTurnState.movementPointsRemaining);
        const hasActionTarget = !currentTurnState.actionTaken && this.interaction.hasAnyActionTarget(activePlayer);
        return hasMovementOption || hasActionTarget;
    }

    private buildAutoEndKey(currentTurnState: MatchTurnState, activePlayer: MatchPlayer): string {
        return `${currentTurnState.currentTurnIndex}:${activePlayer.id}:${currentTurnState.movementPointsRemaining}:${currentTurnState.actionTaken}`;
    }

    private handleCompletedTurn(): void {
        this.interaction.clearActionSelection();
    }
}
