import { computed, inject, Injectable, signal } from '@angular/core';
import { MatchPlayer, MatchSanctuaryChoice, MatchTileInspection } from '@common/game/match.interface';
import { EditorCell } from '@common/maps/map.interface';
import { ObjectType, TileType } from '@common/maps/map.enums';
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
} from '@app/config/game-session.config';
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
        if (this.targets.getSanctuaryActionTargets().size > 0) {
            options.push({ context: 'sanctuary', label: 'Sanctuaire' });
        }
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
            case 'sanctuary':
                return this.targets.getSanctuaryActionTargets();
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
        if (this.actionContext() === 'sanctuary') return 'Choisissez un sanctuaire adjacent en surbrillance.';
        if (this.actionContext() === 'combat') return 'Choisissez un adversaire adjacent pour engager le combat.';
        if (this.actionContext() === 'door') return 'Choisissez une porte adjacente pour l ouvrir ou la fermer.';
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
            this.movementFeedback.set('Choisissez d abord comment utiliser le sanctuaire en attente.');
            return;
        }

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
        if (this.hasLocalPendingSanctuaryChoice()) {
            this.movementFeedback.set('Resolvez d abord le choix de sanctuaire avant de terminer le tour.');
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
            this.movementFeedback.set('Choisissez d abord comment utiliser le sanctuaire en attente.');
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
            ? 'Choisissez un soin normal, un double ou rien, ou annulez.'
            : 'Choisissez un bonus normal, un double ou rien, ou annulez.';
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
        if (this.actionContext() === 'sanctuary') {
            this.handleSanctuaryAction(tile);
        } else if (this.actionContext() === 'combat') {
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
        const localPlayer = this.getLocalMatchPlayer();
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

    private handleSanctuaryAction(tile: EditorCell): void {
        const localPlayer = this.getLocalMatchPlayer();
        const sanctuary = this.display.objectAt(tile.position);
        const isValidSanctuary = sanctuary && (sanctuary.type === ObjectType.REGEN || sanctuary.type === ObjectType.ARENA);
        if (!localPlayer || !this.isActionTarget(tile) || !isValidSanctuary) {
            this.movementFeedback.set('Action ignoree: cible invalide.');
            return;
        }

        this.gameSessionSocket.useSanctuary(localPlayer.id, sanctuary.id);
        this.clearActionSelection();
        this.closeInspection();
        this.movementFeedback.set('Choisissez comment utiliser ce sanctuaire.');
    }

    private handleDoorAction(tile: EditorCell): void {
        const localPlayer = this.getLocalMatchPlayer();
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

    private tryDebugTeleport(tile: EditorCell): boolean {
        const currentMatch = this.display.match();
        const localPlayer = this.getLocalMatchPlayer();
        if (!currentMatch ||
            !localPlayer ||
            !localPlayer.isOrganizer ||
            !currentMatch.debugMode ||
            this.display.matchEndState() ||
            this.display.turnState()?.phase !== 'active' ||
            this.display.turnState()?.activePlayerId !== localPlayer.id) {
            return false;
        }

        if (tile.tileType === TileType.WALL || (tile.tileType === TileType.DOOR && !tile.isWalkable)) {
            this.movementFeedback.set('Teleportation debug refusee: tuile invalide.');
            return true;
        }

        const occupiedByPlayer = currentMatch.players.some(
            (player) => player.id !== localPlayer.id && player.position.x === tile.position.x && player.position.y === tile.position.y,
        );
        const occupiedByObject = !!this.matchState.getObjectCovering(tile.position);
        if (occupiedByPlayer || occupiedByObject) {
            this.movementFeedback.set('Teleportation debug refusee: case occupee.');
            return true;
        }

        this.gameSessionSocket.debugTeleportPlayer(localPlayer.id, tile.position);
        this.closeInspection();
        this.movementFeedback.set(`Teleportation debug envoyee au serveur vers (${tile.position.x}, ${tile.position.y}).`);
        return true;
    }

    private getLocalMatchPlayer(): MatchPlayer | null {
        return this.display.findPlayerById(this.display.localPlayer()?.id ?? null);
    }

    private getPendingSanctuaryObject() {
        const pendingChoice = this.display.match()?.pendingSanctuaryChoice;
        if (!pendingChoice) {
            return null;
        }

        const object = this.display.match()?.allObjects.find((candidate) => candidate.id === pendingChoice.objectId) ?? null;
        if (!object || (object.type !== ObjectType.REGEN && object.type !== ObjectType.ARENA)) {
            return null;
        }

        return object;
    }
}
