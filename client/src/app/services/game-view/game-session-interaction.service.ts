import { computed, inject, Injectable, signal } from '@angular/core';
import { MovementDirection } from '@common/game/movement-direction';
import {
    EDITABLE_TARGET_TAGS,
    GameSessionActionContext,
    GameSessionActionOption,
    MOVEMENT_KEY_BINDINGS,
} from '@app/config/game-session.config';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { MatchMovementService } from '@app/services/match/match-movement.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import { MatchPlayer, MatchSanctuaryChoice, MatchTileInspection } from '@common/game/match.interface';
import { ObjectType } from '@common/maps/map.enums';
import { EditorCell } from '@common/maps/map.interface';
import { GameSessionDisplayService } from './game-session-display.service';
import {
    GameSessionInteractionActionContext,
    getLocalMatchPlayer,
    getPendingSanctuaryObject,
    handlePrimaryActionTile,
    hasActiveInteractionUi,
    tryDebugTeleport,
} from './game-session-interaction.actions';
import { collectActionTargetKeys, createActionTargetSets } from './game-session-interaction-selection.utils';
import { GameSessionTargetsService } from './game-session-targets.service';

@Injectable()
export class GameSessionInteractionService {
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
    readonly sanctuaryPromptUiHold = signal(false);
    readonly availableActionContexts = computed<GameSessionActionOption[]>(() => {
        if (!this.canUseAction()) {
            return [];
        }
        const options: GameSessionActionOption[] = [];
        if (this.targets.getSanctuaryActionTargets().size > 0) {
            options.push({ context: GameSessionActionContext.Sanctuary, label: 'Sanctuaire' });
        }
        if (this.targets.getCombatActionTargets().size > 0) {
            options.push({ context: GameSessionActionContext.Combat, label: 'Combat' });
        }
        if (this.targets.getFlagTransferTargets().size > 0) {
            options.push({ context: GameSessionActionContext.FlagTransfer, label: 'Transferer drapeau' });
        }
        if (this.targets.getDoorActionTargets().size > 0) {
            options.push({ context: GameSessionActionContext.Door, label: 'Ouvrir/Fermer porte' });
        }
        return options;
    });
    readonly actionTargets = computed(() => {
        switch (this.actionContext()) {
            case GameSessionActionContext.Sanctuary:
                return this.targets.getSanctuaryActionTargets();
            case GameSessionActionContext.Combat:
                return this.targets.getCombatActionTargets();
            case GameSessionActionContext.FlagTransfer:
                return this.targets.getFlagTransferTargets();
            case GameSessionActionContext.Door:
                return this.targets.getDoorActionTargets();
            default:
                return this.actionSelectionOpen() ? collectActionTargetKeys(createActionTargetSets(this.targets)) : new Set<string>();
        }
    });

    inspectTile(event: MouseEvent, tile: EditorCell): void {
        event.preventDefault();
        if (this.tryDebugTeleport(tile)) {
            return;
        }
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
        if (this.actionSelectionOpen()) return 'Choisissez une interaction adjacente en surbrillance.';
        if (this.actionContext() === GameSessionActionContext.Sanctuary) return 'Choisissez un sanctuaire adjacent en surbrillance.';
        if (this.actionContext() === GameSessionActionContext.Combat) return 'Choisissez un adversaire adjacent pour engager le combat.';
        if (this.actionContext() === GameSessionActionContext.FlagTransfer) {
            return 'Choisissez un coequipier adjacent pour demander ou offrir le drapeau.';
        }
        if (this.actionContext() === GameSessionActionContext.Door) return "Choisissez une porte adjacente pour l'ouvrir ou la fermer.";
        return '';
    }

    canUseAction(): boolean {
        return this.targets.canUseAction();
    }

    canToggleActionMode(): boolean {
        if (this.hasLocalPendingSanctuaryChoice()) {
            return false;
        }

        return !!this.actionContext() || this.actionSelectionOpen() || this.availableActionContexts().length > 0;
    }

    toggleActionMode(): void {
        if (this.hasLocalPendingSanctuaryChoice()) {
            this.movementFeedback.set("Choisissez d'abord comment utiliser le sanctuaire en attente.");
            return;
        }

        if (this.actionContext() || this.actionSelectionOpen()) {
            this.clearActionSelection();
            return;
        }

        const availableActions = this.availableActionContexts();
        if (availableActions.length === 0) {
            this.movementFeedback.set("Aucune cible d'action valide à porter.");
        } else if (availableActions.length === 1) {
            this.actionContext.set(availableActions[0].context);
        } else {
            this.actionSelectionOpen.set(true);
        }
    }

    endCurrentTurn(): void {
        if (this.hasLocalPendingSanctuaryChoice()) {
            this.movementFeedback.set("Resolvez d'abord le choix de sanctuaire avant de terminer le tour.");
            return;
        }

        const localPlayer = this.display.localPlayer();
        if (localPlayer) {
            const canForceEndTurn =
                !!localPlayer.isOrganizer &&
                !!this.display.match()?.debugMode &&
                !this.display.matchEndState();
            if (canForceEndTurn) {
                this.gameSessionSocket.forceEndDebugTurn(localPlayer.id);
            } else {
                this.gameSessionSocket.endTurn(localPlayer.id);
            }
            this.clearActionSelection();
            this.closeInspection();
        }
    }

    moveLocal(direction: MovementDirection): void {
        if (this.hasLocalPendingSanctuaryChoice()) {
            this.movementFeedback.set("Choisissez d'abord comment utiliser le sanctuaire en attente.");
            return;
        }

        if (this.hasActiveInteractionUi()) {
            this.movementFeedback.set("Fermez d'abord l'interface d'action avant de vous deplacer.");
            return;
        }

        const currentMatch = this.display.match();
        const localPlayer = this.getLocalMatchPlayer();
        const movementPointsRemaining = this.display.turnState()?.movementPointsRemaining ?? 0;
        if (!currentMatch || !localPlayer || !this.targets.isLocalPlayerTurn() || !this.turnStateService.canPerformMovement(localPlayer.id)) {
            return;
        }

        const attempt = this.movementService.tryMove(currentMatch, localPlayer.id, direction, movementPointsRemaining);
        if (!attempt.success || !attempt.destination) {
            this.movementFeedback.set('Deplacement ignore: tuile invalide ou cout trop eleve.');
            return;
        }

        this.gameSessionSocket.movePlayer(localPlayer.id, direction);
        this.closeInspection();
        this.movementFeedback.set(
            `Deplacement envoye au serveur vers (${attempt.destination.x}, ${attempt.destination.y}) pour ${attempt.cost} point(s).`,
        );
    }

    hasAvailableMovement(player: MatchPlayer, movementPointsRemaining: number): boolean {
        return this.targets.hasAvailableMovement(player, movementPointsRemaining);
    }

    hasAnyActionTarget(player: MatchPlayer): boolean {
        return this.targets.hasAnyActionTarget(player);
    }

    hasLocalPendingSanctuaryChoice(): boolean {
        return this.display.hasLocalPendingSanctuaryChoice();
    }

    setSanctuaryPromptUiHold(isHeld: boolean): void {
        this.sanctuaryPromptUiHold.set(isHeld);
    }

    sanctuaryPromptTitle(): string {
        const sanctuary = this.getPendingSanctuaryObject();
        return sanctuary?.type === ObjectType.REGEN ? 'Sanctuaire de soin' : sanctuary ? 'Sanctuaire de combat' : '';
    }

    sanctuaryPromptText(): string {
        const sanctuary = this.getPendingSanctuaryObject();
        if (!sanctuary) {
            return '';
        }

        return sanctuary.type === ObjectType.REGEN
            ? 'Choisissez : soin normal, double ou rien, ou annuler.'
            : 'Choisissez : bonus normal, double ou rien, ou annuler.';
    }

    resolveSanctuaryChoice(choice: MatchSanctuaryChoice): void {
        const localPlayer = this.getLocalMatchPlayer();
        if (!localPlayer || !this.hasLocalPendingSanctuaryChoice()) {
            return;
        }

        this.gameSessionSocket.resolveSanctuaryChoice(localPlayer.id, choice);
        this.movementFeedback.set(
            choice === 'cancel'
                ? 'Utilisation du sanctuaire annulee.'
                : 'Choix de sanctuaire envoye au serveur.',
        );
    }

    handleCellPrimaryAction(tile: EditorCell): void {
        handlePrimaryActionTile(this.createActionContext(), tile);
    }

    handleMovementKeyup(event: KeyboardEvent): void {
        const direction = MOVEMENT_KEY_BINDINGS.get(event.code);
        if (!direction || this.shouldIgnoreMovementShortcut(event)) {
            return;
        }

        event.preventDefault();
        this.moveLocal(direction);
    }

    private shouldIgnoreMovementShortcut(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
            return true;
        }

        const target = event.target;
        return target instanceof HTMLElement && (target.isContentEditable || EDITABLE_TARGET_TAGS.has(target.tagName));
    }

    private tryDebugTeleport(tile: EditorCell): boolean {
        return tryDebugTeleport(this.createActionContext(), tile);
    }

    private getLocalMatchPlayer(): MatchPlayer | null {
        return getLocalMatchPlayer(this.display);
    }

    private getPendingSanctuaryObject() {
        return getPendingSanctuaryObject(this.display);
    }

    private hasActiveInteractionUi(): boolean {
        return hasActiveInteractionUi(this.actionSelectionOpen(), this.actionContext(), this.sanctuaryPromptUiHold());
    }

    private createActionContext(): GameSessionInteractionActionContext {
        return {
            actionContext: this.actionContext,
            actionSelectionOpen: this.actionSelectionOpen,
            clearActionSelection: () => this.clearActionSelection(),
            closeInspection: () => this.closeInspection(),
            display: this.display,
            gameSessionSocket: this.gameSessionSocket,
            isActionTarget: (tile) => this.isActionTarget(tile),
            matchState: this.matchState,
            movementFeedback: this.movementFeedback,
            sanctuaryPromptUiHold: this.sanctuaryPromptUiHold,
            targets: this.targets,
        };
    }
}
