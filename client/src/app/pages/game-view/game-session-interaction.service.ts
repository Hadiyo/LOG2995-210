import { computed, inject, Injectable, signal } from '@angular/core';
import { MatchPlayer, MatchTileInspection } from '@common/game/match.interface';
import { EditorCell } from '@common/maps/map.interface';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { positionKey } from '@app/services/match/match-geometry';
import { CombatStateService } from '@app/services/match/combat-state.service';
import { MatchMovementService, MovementDirection } from '@app/services/match/match-movement.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import {
    EDITABLE_TARGET_TAGS,
    MOVEMENT_KEY_BINDINGS,
    GameSessionActionContext,
    GameSessionActionOption,
} from './game-session.constants';
import { GameSessionDisplayService } from './game-session-display.service';
import { GameSessionTargetsService } from './game-session-targets.service';
@Injectable()
export class GameSessionInteractionService {
    private readonly combatStateService = inject(CombatStateService);
    private readonly display = inject(GameSessionDisplayService);
    private readonly gameSessionSocket = inject(GameSessionSocketService);
    private readonly matchState = inject(MatchStateService);
    private readonly movementService = inject(MatchMovementService);
    private readonly targets = inject(GameSessionTargetsService);
    private readonly turnStateService = inject(TurnStateService);
    readonly inspectedTile = signal<MatchTileInspection | null>(null);
    readonly movementFeedback = signal('');
    readonly actionContext = signal<GameSessionActionContext | null>(null);
    readonly actionSelectionOpen = signal(false);
    readonly availableActionContexts = computed<GameSessionActionOption[]>(() => {
        if (!this.canUseAction()) {
            return [];
        }
        const options: GameSessionActionOption[] = [];
        if (this.targets.getCombatActionTargets().size > 0) {
            options.push({ context: 'combat', label: 'Combat' });
        }
        if (this.targets.getDoorActionTargets().size > 0) {
            options.push({ context: 'door', label: 'Ouvrir/Fermer porte' });
        }
        return options;
    });
    readonly actionTargets = computed(() => {
        switch (this.actionContext()) {
            case 'combat':
                return this.targets.getCombatActionTargets();
            case 'door':
                return this.targets.getDoorActionTargets();
            default:
                return new Set<string>();
        }
    });
    inspectTile(event: MouseEvent, tile: EditorCell): void {
        event.preventDefault();
        if (!this.display.matchEndState()) {
            this.inspectedTile.set(this.display.inspectTile(tile.position));
        }
    }

    closeInspection(): void {
        this.inspectedTile.set(null);
    }

    clearActionSelection(): void {
        this.actionSelectionOpen.set(false);
        this.actionContext.set(null);
    }

    isActionTarget(tile: EditorCell): boolean {
        return this.actionTargets().has(positionKey(tile.position));
    }

    actionHelperText(): string {
        if (this.actionContext() === 'combat') return 'Choisissez un adversaire adjacent pour engager le combat.';
        if (this.actionContext() === 'door') return 'Choisissez une porte adjacente pour l ouvrir ou la fermer.';
        return '';
    }

    canUseAction(): boolean {
        return this.targets.canUseAction();
    }

    canToggleActionMode(): boolean {
        return !!this.actionContext() || this.actionSelectionOpen() || this.availableActionContexts().length > 0;
    }

    toggleActionMode(): void {
        if (this.actionContext() || this.actionSelectionOpen()) {
            this.clearActionSelection();
            return;
        }

        const availableActions = this.availableActionContexts();
        if (availableActions.length === 0) {
            this.movementFeedback.set('Aucune cible d action valide a portee.');
        } else if (availableActions.length === 1) {
            this.actionContext.set(availableActions[0].context);
        } else {
            this.actionSelectionOpen.set(true);
        }
    }

    selectActionContext(context: GameSessionActionContext): void {
        this.actionSelectionOpen.set(false);
        this.actionContext.set(context);
    }

    endCurrentTurn(): void {
        const localPlayer = this.display.localPlayer();
        if (localPlayer) {
            this.gameSessionSocket.endTurn(localPlayer.id);
            this.clearActionSelection();
            this.closeInspection();
        }
    }

    moveLocal(direction: MovementDirection): void {
        const currentMatch = this.display.match();
        const localPlayer = this.display.localPlayer();
        const movementPointsRemaining = this.display.turnState()?.movementPointsRemaining ?? 0;
        if (!currentMatch || !localPlayer || !this.targets.isLocalPlayerTurn() || !this.turnStateService.canPerformMovement(localPlayer.id)) {
            return;
        }

        const attempt = this.movementService.tryMove(currentMatch, localPlayer.id, direction, movementPointsRemaining);
        if (!attempt.success || !attempt.destination) {
            this.movementFeedback.set('Deplacement ignore: tuile invalide ou cout trop eleve.');
            return;
        }

        this.matchState.updatePlayerPosition(localPlayer.id, attempt.destination);
        this.turnStateService.recordMovement(localPlayer.id, attempt.cost);
        this.gameSessionSocket.movePlayer(localPlayer.id, direction);
        this.closeInspection();
        this.movementFeedback.set(
            `Deplacement effectue vers (${attempt.destination.x}, ${attempt.destination.y}) pour ${attempt.cost} point(s). ` +
            'Le serveur synchronise maintenant le nouvel etat pour tous les joueurs.',
        );
    }

    hasAvailableMovement(player: MatchPlayer, movementPointsRemaining: number): boolean {
        return this.targets.hasAvailableMovement(player, movementPointsRemaining);
    }

    hasAnyActionTarget(player: MatchPlayer): boolean {
        return this.targets.hasAnyActionTarget(player);
    }

    handleCellPrimaryAction(tile: EditorCell): void {
        if (this.actionContext() === 'combat') {
            this.handleCombatAction(tile);
        } else if (this.actionContext() === 'door') {
            this.handleDoorAction(tile);
        }
    }

    handleMovementKeyup(event: KeyboardEvent): void {
        const direction = MOVEMENT_KEY_BINDINGS.get(event.code);
        if (!direction || this.shouldIgnoreMovementShortcut(event)) {
            return;
        }

        event.preventDefault();
        this.moveLocal(direction);
    }

    private handleCombatAction(tile: EditorCell): void {
        const localPlayer = this.display.localPlayer();
        const targetPlayer = this.display.playerAt(tile);
        if (!localPlayer || !this.isActionTarget(tile) || !targetPlayer) {
            this.movementFeedback.set('Action ignoree: cible invalide.');
            return;
        }

        if (!this.combatStateService.startCombat(localPlayer.id, targetPlayer.id)) {
            this.movementFeedback.set('Action ignoree: combat impossible.');
            return;
        }

        this.gameSessionSocket.startCombat(localPlayer.id, targetPlayer.id);
        this.clearActionSelection();
        this.closeInspection();
        this.movementFeedback.set(`Combat engage contre ${targetPlayer.name}.`);
    }

    private handleDoorAction(tile: EditorCell): void {
        const localPlayer = this.display.localPlayer();
        if (!localPlayer || !this.isActionTarget(tile)) {
            this.movementFeedback.set('Action ignoree: cible invalide.');
            return;
        }

        this.gameSessionSocket.toggleDoor(localPlayer.id, tile.position);
        this.clearActionSelection();
        this.closeInspection();
        this.movementFeedback.set(`Porte en (${tile.position.x}, ${tile.position.y}) actionnee.`);
    }

    private shouldIgnoreMovementShortcut(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
            return true;
        }

        const target = event.target;
        return target instanceof HTMLElement && (target.isContentEditable || EDITABLE_TARGET_TAGS.has(target.tagName));
    }
}
