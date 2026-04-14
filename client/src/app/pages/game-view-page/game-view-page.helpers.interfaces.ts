import { WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { GameSessionDisplayService } from '@app/services/game-view/game-session-display.service';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { GameSessionTurnEffectsService } from '@app/services/game-view/game-session-turn-effects.service';
import { CombatStateService } from '@app/services/match/combat-state.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch } from '@common/game/match.interface';

export interface IncomingFlagTransferView {
    kind: NonNullable<InitializedMatch['pendingFlagTransfer']>['kind'];
    requesterName: string;
}

export interface MatchEndRedirectState {
    intervalId: number | null;
    scheduledMatchEndId: string | null;
    timeoutId: number | null;
}

export interface MatchEndRedirectContext {
    endRedirectRemainingMs: WritableSignal<number>;
    interaction: GameSessionInteractionService;
    matchState: MatchStateService;
    router: Router;
    state: MatchEndRedirectState;
}

export interface GameViewPageInitContext {
    chatService: ChatService;
    display: GameSessionDisplayService;
    gameSessionSocket: GameSessionSocketService;
    localPoseRefreshMs: number;
    matchState: MatchStateService;
    navigationMessages: ChatMessage[];
    nowMs: WritableSignal<number>;
    sessionId: string | null;
}

export interface GameViewPageDestroyContext {
    chatService: ChatService;
    combat: CombatStateService;
    effects: GameSessionTurnEffectsService;
    endRedirectRemainingMs: WritableSignal<number>;
    localPoseIntervalId: number | null;
    matchEndRedirectState: MatchEndRedirectState;
}

export interface GameViewPageMatchCommandContext {
    display: GameSessionDisplayService;
    gameSessionSocket: GameSessionSocketService;
    matchState: MatchStateService;
}

export interface GameViewCellContextMenuPayload {
    event: MouseEvent;
    index: number;
}

export interface GameViewDebugShortcutContext {
    canToggleDebugMode: boolean;
    closeTileInfoModal: () => void;
    combatActive: boolean;
    combatClose: () => void;
    matchEnded: boolean;
    onToggleDebugMode: () => void;
    selectedTileInfo: unknown;
}