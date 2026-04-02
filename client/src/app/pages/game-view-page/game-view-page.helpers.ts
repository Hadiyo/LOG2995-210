import { WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { CLOCK_TICK_MS, MATCH_END_REDIRECT_DURATION_MS } from '@app/config/game-session.config';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch, MatchEndState } from '@common/game/match.interface';

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
        void router.navigate(['/end-game']);
    }, MATCH_END_REDIRECT_DURATION_MS);

    return {
        intervalId,
        scheduledMatchEndId: endState.id,
        timeoutId,
    };
}
