import { WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { CLOCK_TICK_MS, MATCH_END_REDIRECT_DURATION_MS } from '@app/config/game-session.config';
import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { GameSessionDisplayService } from '@app/services/game-view/game-session-display.service';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { startLocalPoseRefreshClock, stopLocalPoseRefreshClock } from '@app/utils/game-view/game-view-pose-clock.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch, MatchEndState } from '@common/game/match.interface';
import { GameCell } from '@common/maps/map.interface';

export type IncomingFlagTransferView = {
    kind: NonNullable<InitializedMatch['pendingFlagTransfer']>['kind'];
    requesterName: string;
};

export type MatchEndRedirectState = {
    intervalId: number | null;
    scheduledMatchEndId: string | null;
    timeoutId: number | null;
};

export type MatchEndRedirectContext = {
    endRedirectRemainingMs: WritableSignal<number>;
    interaction: GameSessionInteractionService;
    matchState: MatchStateService;
    router: Router;
    state: MatchEndRedirectState;
};

export type GameViewPageInitContext = {
    chatService: ChatService;
    display: GameSessionDisplayService;
    gameSessionSocket: GameSessionSocketService;
    localPoseRefreshMs: number;
    matchState: MatchStateService;
    navigationMessages: ChatMessage[];
    nowMs: WritableSignal<number>;
    sessionId: string | null;
};

export type GameViewPageDestroyContext = {
    chatService: ChatService;
    effects: { destroy(): void };
    endRedirectRemainingMs: WritableSignal<number>;
    localPoseIntervalId: number | null;
    matchEndRedirectState: MatchEndRedirectState;
};

export type GameViewPageMatchCommandContext = {
    display: GameSessionDisplayService;
    gameSessionSocket: GameSessionSocketService;
    matchState: MatchStateService;
};

export function buildIncomingFlagTransfer(
    match: InitializedMatch | null | undefined,
    localPlayerId: string,
): IncomingFlagTransferView | null {
    const pendingTransfer = match?.pendingFlagTransfer ?? null;
    if (!match || !localPlayerId || !pendingTransfer || pendingTransfer.receiverId !== localPlayerId) {
        return null;
    }

    const requester = match.players.find((player) => player.id === pendingTransfer.requesterId) ?? null;
    if (!requester) {
        return null;
    }

    return {
        kind: pendingTransfer.kind,
        requesterName: requester.name,
    };
}

export function buildChatMessage(author: string, content: string): ChatMessage {
    return {
        author,
        content,
        createdAt: new Date().toISOString(),
    };
}

export function initializeGameViewPage(context: GameViewPageInitContext): number | null {
    const {
        chatService,
        display,
        gameSessionSocket,
        localPoseRefreshMs,
        matchState,
        navigationMessages,
        nowMs,
        sessionId,
    } = context;
    const localPoseIntervalId = startLocalPoseRefreshClock(nowMs, localPoseRefreshMs);
    const localPlayer = display.localPlayer();

    if (!sessionId || !localPlayer) {
        matchState.errorMessage.set('Impossible de joindre la session multijoueur.');
        matchState.state.set('error');
        return localPoseIntervalId;
    }

    matchState.state.set('loading');
    chatService.clearChat();
    chatService.loadChatMessages(navigationMessages);
    gameSessionSocket.joinSession(sessionId, localPlayer.id);
    chatService.initChat();
    return localPoseIntervalId;
}

export function destroyGameViewPage(context: GameViewPageDestroyContext): MatchEndRedirectState {
    context.chatService.unsubscribeToSocketEvents();
    context.effects.destroy();
    stopLocalPoseRefreshClock(context.localPoseIntervalId);
    return clearMatchEndRedirect(context.matchEndRedirectState, context.endRedirectRemainingMs);
}

export function leaveMatch(message: string, context: GameViewPageMatchCommandContext): void {
    const localPlayer = context.display.localPlayer();
    if (localPlayer) {
        context.gameSessionSocket.surrender(localPlayer.id);
    }

    if (context.display.matchEndState()) {
        context.matchState.endLocalSession(message);
        return;
    }

    context.matchState.abandonLocalPlayer(message);
}

export function handleGameViewCellClick(
    hasActiveCombat: boolean,
    interaction: GameSessionInteractionService,
    mapCells: readonly GameCell[],
    index: number,
): void {
    if (hasActiveCombat) {
        return;
    }

    const tile = mapCells[index];
    if (tile) {
        interaction.handleCellPrimaryAction(tile);
    }
}

export function handleGameViewCellContextMenu(
    hasActiveCombat: boolean,
    interaction: GameSessionInteractionService,
    mapCells: readonly GameCell[],
    payload: { event: MouseEvent; index: number },
): void {
    if (hasActiveCombat) {
        return;
    }

    const tile = mapCells[payload.index];
    if (tile) {
        interaction.inspectTile(payload.event, tile);
    }
}

export function handleGameViewEndTurn(hasActiveCombat: boolean, interaction: GameSessionInteractionService): void {
    if (!hasActiveCombat) {
        interaction.endCurrentTurn();
    }
}

export function handleGameViewToggleActionMode(
    hasActiveCombat: boolean,
    interaction: GameSessionInteractionService,
): void {
    if (!hasActiveCombat) {
        interaction.toggleActionMode();
    }
}

export function handleIncomingFlagTransferResponse(
    accepted: boolean,
    incomingFlagTransfer: IncomingFlagTransferView | null,
    localPlayerId: string,
    gameSessionSocket: GameSessionSocketService,
    interaction: GameSessionInteractionService,
): void {
    if (!localPlayerId || !incomingFlagTransfer) {
        return;
    }

    gameSessionSocket.resolveFlagTransfer(localPlayerId, accepted);
    interaction.movementFeedback.set(accepted ? 'Transfert du drapeau accepte.' : 'Transfert du drapeau refuse.');
}

export function handleGameViewToggleDebugMode(
    localPlayerId: string,
    canToggleDebugMode: boolean,
    matchEnded: boolean,
    gameSessionSocket: GameSessionSocketService,
): void {
    if (!localPlayerId || !canToggleDebugMode || matchEnded) {
        return;
    }

    gameSessionSocket.toggleDebugMode(localPlayerId);
}

export function handleGameViewMovementKeyup(
    event: KeyboardEvent,
    hasActiveCombat: boolean,
    interaction: GameSessionInteractionService,
): void {
    if (!hasActiveCombat) {
        interaction.handleMovementKeyup(event);
    }
}

export function handleGameViewDebugShortcut(
    event: KeyboardEvent,
    context: {
        canToggleDebugMode: boolean;
        closeTileInfoModal: () => void;
        combatActive: boolean;
        combatClose: () => void;
        matchEnded: boolean;
        onToggleDebugMode: () => void;
        selectedTileInfo: unknown;
    },
): void {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
        return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return;
    }

    if (event.key === 'Escape') {
        if (context.combatActive) {
            event.preventDefault();
            context.combatClose();
            return;
        }

        if (context.selectedTileInfo) {
            event.preventDefault();
            context.closeTileInfoModal();
        }
        return;
    }

    if (event.key.toLowerCase() !== 'm' || !context.canToggleDebugMode || context.matchEnded) {
        return;
    }

    event.preventDefault();
    context.onToggleDebugMode();
}

export function handleGameViewBrowserRefresh(
    hasLocalPlayer: boolean,
    leaveMatchFn: (message: string) => void,
    matchEndMessage: string | null,
): void {
    if (!hasLocalPlayer) {
        return;
    }

    leaveMatchFn(matchEndMessage ?? 'Rafraichissement detecte: la partie a ete consideree comme un abandon.');
}

export function clearMatchEndRedirect(
    state: MatchEndRedirectState,
    endRedirectRemainingMs: WritableSignal<number>,
): MatchEndRedirectState {
    if (state.timeoutId !== null) {
        window.clearTimeout(state.timeoutId);
    }

    if (state.intervalId !== null) {
        window.clearInterval(state.intervalId);
    }

    endRedirectRemainingMs.set(0);
    return {
        ...state,
        intervalId: null,
        timeoutId: null,
    };
}

export function syncMatchEndRedirect(
    endState: MatchEndState | null,
    context: MatchEndRedirectContext,
): MatchEndRedirectState {
    const { endRedirectRemainingMs, interaction, matchState, router, state } = context;
    if (!endState) {
        return { ...clearMatchEndRedirect(state, endRedirectRemainingMs), scheduledMatchEndId: null };
    }

    if (state.scheduledMatchEndId === endState.id) {
        return state;
    }

    interaction.clearActionSelection();
    interaction.closeInspection();

    clearMatchEndRedirect(state, endRedirectRemainingMs);
    const redirectEndsAt = Date.now() + MATCH_END_REDIRECT_DURATION_MS;
    endRedirectRemainingMs.set(MATCH_END_REDIRECT_DURATION_MS);

    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    intervalId = window.setInterval(() => {
        endRedirectRemainingMs.set(Math.max(0, redirectEndsAt - Date.now()));
    }, CLOCK_TICK_MS);

    timeoutId = window.setTimeout(() => {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
        }
        if (intervalId !== null) {
            window.clearInterval(intervalId);
        }
        endRedirectRemainingMs.set(0);
        matchState.endLocalSession(endState.message);
        void router.navigate(['/home']);
    }, MATCH_END_REDIRECT_DURATION_MS);

    return {
        intervalId,
        scheduledMatchEndId: endState.id,
        timeoutId,
    };
}
