import { GameSessionActionContext } from '@app/config/game-session.config';
import { positionKey } from '@app/services/match/match-geometry';
import { InitializedMatch, MatchEndState, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, MapObject } from '@common/maps/map.interface';
import { createActionTargetSets, resolveActionContextFromTile } from './game-session-interaction-selection.utils';
import { GameSessionTargetsService } from './game-session-targets.service';

type FeedbackSignal = { set: (value: string) => void };
type SignalReader<T> = () => T;

export interface GameSessionInteractionActionContext {
    actionContext: SignalReader<GameSessionActionContext | null>;
    actionSelectionOpen: SignalReader<boolean>;
    clearActionSelection: () => void;
    closeInspection: () => void;
    display: {
        findPlayerById: (playerId: string | null) => MatchPlayer | null;
        localPlayer: SignalReader<{ id: string } | null>;
        match: SignalReader<InitializedMatch | null>;
        matchEndState: SignalReader<MatchEndState | null>;
        objectAt: (position: EditorCell['position']) => MapObject | null;
        playerAt: (tile: EditorCell) => MatchPlayer | null;
        turnState: SignalReader<MatchTurnState | null>;
    };
    gameSessionSocket: {
        debugTeleportPlayer: (playerId: string, position: EditorCell['position']) => void;
        requestFlagTransfer: (playerId: string, teammateId: string) => void;
        startCombat: (playerId: string, defenderId: string) => void;
        toggleDoor: (playerId: string, position: EditorCell['position']) => void;
        useSanctuary: (playerId: string, sanctuaryId: number) => void;
    };
    isActionTarget: (tile: EditorCell) => boolean;
    matchState: {
        getObjectCovering: (position: EditorCell['position']) => MapObject | null;
    };
    movementFeedback: FeedbackSignal;
    sanctuaryPromptUiHold: SignalReader<boolean>;
    targets: GameSessionTargetsService;
}

export const getLocalMatchPlayer = (display: GameSessionInteractionActionContext['display']): MatchPlayer | null =>
    display.findPlayerById(display.localPlayer()?.id ?? null);

export const getPendingSanctuaryObject = (display: GameSessionInteractionActionContext['display']) => {
    const pendingChoice = display.match()?.pendingSanctuaryChoice;
    if (!pendingChoice) {
        return null;
    }

    const object = display.match()?.allObjects.find((candidate) => candidate.id === pendingChoice.objectId) ?? null;
    if (!object || (object.type !== ObjectType.REGEN && object.type !== ObjectType.ARENA)) {
        return null;
    }

    return object;
};

export const hasActiveInteractionUi = (
    actionSelectionOpen: boolean,
    actionContext: GameSessionActionContext | null,
    sanctuaryPromptUiHold: boolean,
): boolean => actionSelectionOpen || !!actionContext || sanctuaryPromptUiHold;

export const handlePrimaryActionTile = (context: GameSessionInteractionActionContext, tile: EditorCell): void => {
    if (context.actionContext() === GameSessionActionContext.Sanctuary) {
        handleSanctuaryAction(context, tile);
    } else if (context.actionContext() === GameSessionActionContext.Combat) {
        handleCombatAction(context, tile);
    } else if (context.actionContext() === GameSessionActionContext.FlagTransfer) {
        handleFlagTransferAction(context, tile);
    } else if (context.actionContext() === GameSessionActionContext.Door) {
        handleDoorAction(context, tile);
    } else if (context.actionSelectionOpen()) {
        handleHighlightedAction(context, tile);
    }
};

export const tryDebugTeleport = (context: GameSessionInteractionActionContext, tile: EditorCell): boolean => {
    const currentMatch = context.display.match();
    const localPlayer = getLocalMatchPlayer(context.display);
    if (!currentMatch ||
        !localPlayer ||
        !currentMatch.debugMode ||
        context.display.matchEndState() ||
        context.display.turnState()?.phase !== 'active' ||
        context.display.turnState()?.activePlayerId !== localPlayer.id) {
        return false;
    }

    if (tile.tileType === TileType.WALL || (tile.tileType === TileType.DOOR && !tile.isWalkable)) {
        context.movementFeedback.set('Teleportation debug refusee: tuile invalide.');
        return true;
    }

    const occupiedByPlayer = currentMatch.players.some(
        (player: MatchPlayer) => player.id !== localPlayer.id && player.position.x === tile.position.x && player.position.y === tile.position.y,
    );
    const occupiedByObject = !!context.matchState.getObjectCovering(tile.position);
    if (occupiedByPlayer || occupiedByObject) {
        context.movementFeedback.set('Teleportation debug refusee: case occupee.');
        return true;
    }

    context.gameSessionSocket.debugTeleportPlayer(localPlayer.id, tile.position);
    context.closeInspection();
    context.movementFeedback.set(`Teleportation debug envoyee au serveur vers (${tile.position.x}, ${tile.position.y}).`);
    return true;
};

const handleCombatAction = (context: GameSessionInteractionActionContext, tile: EditorCell): void => {
    const localPlayer = getLocalMatchPlayer(context.display);
    const targetPlayer = context.display.playerAt(tile);
    if (!localPlayer || !targetPlayer) {
        context.movementFeedback.set('Action ignoree: cible invalide.');
        return;
    }

    context.gameSessionSocket.startCombat(localPlayer.id, targetPlayer.id);
    context.clearActionSelection();
    context.closeInspection();
    context.movementFeedback.set(`Combat engage contre ${targetPlayer.name}.`);
};

const handleDoorAction = (context: GameSessionInteractionActionContext, tile: EditorCell): void => {
    const localPlayer = getLocalMatchPlayer(context.display);
    if (!localPlayer || !context.isActionTarget(tile)) {
        context.movementFeedback.set('Action ignoree: cible invalide.');
        return;
    }

    context.gameSessionSocket.toggleDoor(localPlayer.id, tile.position);
    context.clearActionSelection();
    context.closeInspection();
    context.movementFeedback.set(`Porte en (${tile.position.x}, ${tile.position.y}) actionnee.`);
};

const handleFlagTransferAction = (context: GameSessionInteractionActionContext, tile: EditorCell): void => {
    const localPlayer = getLocalMatchPlayer(context.display);
    const targetPlayer = context.display.playerAt(tile);
    if (!localPlayer || !context.isActionTarget(tile) || !targetPlayer) {
        context.movementFeedback.set('Action ignoree: transfert de drapeau impossible.');
        return;
    }

    context.gameSessionSocket.requestFlagTransfer(localPlayer.id, targetPlayer.id);
    context.clearActionSelection();
    context.closeInspection();
    context.movementFeedback.set(`Demande de transfert envoyee a ${targetPlayer.name}.`);
};

const handleHighlightedAction = (context: GameSessionInteractionActionContext, tile: EditorCell): void => {
    const actionContext = resolveActionContextFromTile(positionKey(tile.position), createActionTargetSets(context.targets));
    if (!actionContext) {
        context.movementFeedback.set('Action ignoree: cible invalide.');
        return;
    }

    const actionHandlers = new Map<GameSessionActionContext, () => void>([
        [GameSessionActionContext.Sanctuary, () => handleSanctuaryAction(context, tile)],
        [GameSessionActionContext.Combat, () => handleCombatAction(context, tile)],
        [GameSessionActionContext.FlagTransfer, () => handleFlagTransferAction(context, tile)],
        [GameSessionActionContext.Door, () => handleDoorAction(context, tile)],
    ]);
    actionHandlers.get(actionContext)?.();
};

const handleSanctuaryAction = (context: GameSessionInteractionActionContext, tile: EditorCell): void => {
    const localPlayer = getLocalMatchPlayer(context.display);
    const sanctuary = context.display.objectAt(tile.position);
    const isValidSanctuary = sanctuary && (sanctuary.type === ObjectType.REGEN || sanctuary.type === ObjectType.ARENA);
    if (!localPlayer || !context.isActionTarget(tile) || !isValidSanctuary) {
        context.movementFeedback.set('Action ignoree: cible invalide.');
        return;
    }

    context.gameSessionSocket.useSanctuary(localPlayer.id, sanctuary.id);
    context.clearActionSelection();
    context.closeInspection();
    context.movementFeedback.set('Choisissez comment utiliser ce sanctuaire.');
};
