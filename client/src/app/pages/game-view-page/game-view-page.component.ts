import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { GameActionBarComponent } from '@app/components/game/game-action-bar/game-action-bar.component';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { GameCurrentPlayerPanelComponent } from '@app/components/game/game-current-player-panel/game-current-player-panel.component';
import { GameMapActionPromptComponent } from '@app/components/game/game-map-action-prompt/game-map-action-prompt.component';
import { GameMapGridComponent } from '@app/components/game/game-map-grid/game-map-grid.component';
import { GamePlayerListComponent } from '@app/components/game/game-player-list/game-player-list.component';
import { GameSessionInfoPanelComponent } from '@app/components/game/game-session-info-panel/game-session-info-panel.component';
import { GameTileInfoModalComponent } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.component';
import {
    ACTIVE_TURN_DURATION_MS,
    MILLISECONDS_PER_SECOND,
    TRANSITION_DURATION_MS,
} from '@app/config/game-session.config';
import { GAME_VIEW_CONSTANTS } from '@app/config/game-view.config';
import { MAP_SIZE_CONFIG } from '@app/config/map.config';
import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { GameSessionDisplayService } from '@app/services/game-view/game-session-display.service';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { GameSessionTargetsService } from '@app/services/game-view/game-session-targets.service';
import { GameSessionTurnEffectsService } from '@app/services/game-view/game-session-turn-effects.service';
import { positionKey } from '@app/services/match/match-geometry';
import { MatchStateService } from '@app/services/match/match-state.service';
import { createPanelAvatarDirection, createPanelAvatarId, createPanelAvatarState } from '@app/utils/game-view/game-view-avatar.utils';
import { getPhaseDescription, getPhaseHeadline } from '@app/utils/game-view/game-view-phase.utils';
import { getActivePanelPlayer, getVirtualPlayerBadgeLabel, toGamePlayer } from '@app/utils/game-view/game-view-player.utils';
import { startLocalPoseRefreshClock, stopLocalPoseRefreshClock } from '@app/utils/game-view/game-view-pose-clock.utils';
import { createSelectedTileInfo } from '@app/utils/game-view/game-view-tile-info.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { MapSize } from '@common/maps/map.enums';
import { GameCell } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';
import {
    buildChatMessage,
    buildIncomingFlagTransfer,
    clearMatchEndRedirect,
    MatchEndRedirectState,
    syncMatchEndRedirect,
} from './game-view-page.helpers';
@Component({
    selector: 'app-game-view-page',
    standalone: true,
    imports: [
        CommonModule,
        GameMapGridComponent,
        GameMapActionPromptComponent,
        GamePlayerListComponent,
        GameActionBarComponent,
        GameChatPanelComponent,
        GameSessionInfoPanelComponent,
        GameCurrentPlayerPanelComponent,
        GameTileInfoModalComponent,
    ],
    templateUrl: './game-view-page.component.html',
    styleUrls: ['./game-view-page.component.scss'],
    providers: [GameSessionDisplayService, GameSessionInteractionService, GameSessionTargetsService, GameSessionTurnEffectsService],
})
export class GameViewPageComponent implements OnInit, OnDestroy {
    private static readonly activeTurnDurationSeconds = ACTIVE_TURN_DURATION_MS / MILLISECONDS_PER_SECOND;
    private static readonly localPoseRefreshMs = 100;
    private static readonly transitionDurationSeconds = TRANSITION_DURATION_MS / MILLISECONDS_PER_SECOND;

    protected readonly constants = GAME_VIEW_CONSTANTS;
    protected readonly display = inject(GameSessionDisplayService);
    protected readonly interaction = inject(GameSessionInteractionService);
    protected readonly targets = inject(GameSessionTargetsService);
    protected readonly effects = inject(GameSessionTurnEffectsService);

    private readonly matchState = inject(MatchStateService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly gameSessionSocket = inject(GameSessionSocketService);
    private readonly chatService = inject(ChatService);

    protected readonly endRedirectRemainingMs = signal(0);
    protected readonly errorMessage = computed(() => this.gameSessionSocket.errorMessage() || this.display.errorMessage());
    protected readonly match = this.display.match;
    protected readonly localPlayerId = computed(() => this.display.localPlayer()?.id ?? '');
    protected readonly leftPanelTab = signal<'player' | 'turn-order'>('player');
    protected readonly isPlayerListExpanded = signal(false);
    protected readonly isTurnStatusPanelOpen = signal(false);
    protected readonly nowMs = signal(Date.now());
    protected readonly mapCells = computed<readonly GameCell[]>(() => this.match()?.map ?? []);
    protected readonly mapObjects = computed(() => this.match()?.objects ?? []);
    protected readonly inactiveSanctuaryObjectIds = computed<ReadonlySet<number>>(
        () => new Set((this.match()?.sanctuaryStates ?? []).filter((state) => state.cooldownTurnsRemaining > 0).map((state) => state.objectId)),
    );
    protected readonly cols = computed<number>(() => this.match()?.mapSize ?? MapSize.S);
    protected readonly rows = computed<number>(() => this.match()?.mapSize ?? MapSize.S);
    protected readonly maxPlayers = computed<number>(() => {
        const mapSize = this.match()?.mapSize;
        return MAP_SIZE_CONFIG.find((config) => config.value === mapSize)?.maxPlayers ?? this.players().length;
    });
    protected readonly turnOrder = computed<readonly string[]>(() => this.display.turnOrderedPlayers().map((player) => player.id));
    protected readonly players = computed<readonly Player[]>(() => {
        const currentTurnState = this.display.turnState();
        const pendingSanctuaryPlayerId = this.match()?.pendingSanctuaryChoice?.playerId ?? null;
        return (this.match()?.players ?? []).map((player) =>
            toGamePlayer(
                player,
                currentTurnState?.activePlayerId ?? null,
                (currentTurnState?.actionTaken ?? true) || pendingSanctuaryPlayerId === player.id,
                this.display.localMovementPointsRemaining(),
                this.match()?.flagCarrierId ?? null,
            ),
        );
    });
    protected readonly activePlayerId = computed<string>(() => this.display.turnState()?.activePlayerId ?? '');
    protected readonly winningTeamId = computed(() => this.display.matchEndState()?.winnerTeamId ?? null);
    protected readonly winnerKind = computed(() => this.display.matchEndState()?.winnerKind ?? 'none');
    protected readonly activePlayer = computed<Player | null>(() =>
        this.players().find((player) => player.id === this.activePlayerId()) ?? null,
    );
    protected readonly currentPlayer = computed<Player | null>(() =>
        this.players().find((player) => player.id === this.localPlayerId()) ?? null,
    );
    protected readonly panelAvatarId = createPanelAvatarId(this.currentPlayer);
    protected readonly panelAvatarState = createPanelAvatarState(this.currentPlayer, this.nowMs);
    protected readonly panelAvatarDirection = createPanelAvatarDirection(this.currentPlayer);
    protected readonly activePlayersCount = computed<number>(() =>
        this.players().filter((player) => player.state.status === PlayerStatus.Active).length,
    );
    protected readonly debugModeEnabled = computed<boolean>(() => this.match()?.debugMode ?? false);
    protected readonly canToggleDebugMode = computed<boolean>(() => this.currentPlayer()?.information.isOrganizer ?? false);
    protected readonly hasLocalPendingSanctuaryChoice = computed<boolean>(() => this.interaction.hasLocalPendingSanctuaryChoice());
    protected readonly canEndTurn = computed<boolean>(() =>
        !this.hasLocalPendingSanctuaryChoice() &&
        (this.canAct() || (this.debugModeEnabled() && (this.currentPlayer()?.information.isOrganizer ?? false))),
    );
    protected readonly canAct = computed<boolean>(() =>
        this.targets.isLocalPlayerTurn() && !this.display.matchEndState() && !this.hasLocalPendingSanctuaryChoice(),
    );
    protected readonly canUseActionMode = computed<boolean>(() =>
        !this.hasLocalPendingSanctuaryChoice() && this.interaction.canToggleActionMode(),
    );
    protected readonly actionModeEnabled = computed<boolean>(() =>
        this.interaction.actionSelectionOpen() || !!this.interaction.actionContext(),
    );
    protected readonly remainingSeconds = computed<number>(() =>
        this.display.turnState()?.phase === 'active'
            ? this.display.activeTurnCountdownSeconds()
            : this.display.transitionCountdownSeconds(),
    );
    protected readonly totalSeconds = computed<number>(() =>
        this.display.turnState()?.phase === 'active'
            ? GameViewPageComponent.activeTurnDurationSeconds
            : GameViewPageComponent.transitionDurationSeconds,
    );
    protected readonly highlightTimer = computed<boolean>(() => this.display.turnState()?.phase === 'active');
    protected readonly showTurnStatusOverlay = computed<boolean>(() =>
        this.isTurnStatusPanelOpen() || this.display.turnState()?.phase === 'transition',
    );
    protected readonly canCloseTurnStatusOverlay = computed<boolean>(() => this.display.turnState()?.phase !== 'transition');
    protected readonly activePanelPlayer = computed<Player | null>(() =>
        getActivePanelPlayer(
            this.display.turnState()?.phase ?? null,
            this.activePlayer(),
            this.players(),
            this.display.transitionTargetPlayer()?.id ?? null,
        ),
    );
    protected readonly activePanelName = computed<string | null>(() => this.activePanelPlayer()?.information.name ?? null);
    protected readonly activePanelBadge = computed<string | null>(() => getVirtualPlayerBadgeLabel(this.activePanelPlayer()?.information));
    protected readonly reachableCellKeys = computed<ReadonlySet<string>>(
        () => new Set<string>(this.display.reachableTiles().keys()),
    );
    protected readonly reachableOriginKey = computed<string | null>(() => {
        const localPlayerId = this.display.localPlayer()?.id ?? null;
        const player = this.match()?.players.find((candidate) => candidate.id === localPlayerId);
        return player ? positionKey(player.position) : null;
    });
    protected readonly turnDetails = computed<readonly MatchPlayer[]>(() => this.display.turnOrderedPlayers());
    protected readonly selectedTileInfo = createSelectedTileInfo(
        this.interaction.inspectedTile, this.mapCells, this.mapObjects, this.players, this.inactiveSanctuaryObjectIds,
    );
    protected readonly chatMessages = toSignal(this.chatService.chat$, { initialValue: [] as ChatMessage[] });
    protected readonly incomingFlagTransfer = computed(() => buildIncomingFlagTransfer(this.match(), this.localPlayerId()));

    private matchEndRedirectState: MatchEndRedirectState = {
        intervalId: null,
        scheduledMatchEndId: null,
        timeoutId: null,
    };
    private localPoseIntervalId: number | null = null;

    constructor() {
        effect(() => {
            this.matchEndRedirectState = syncMatchEndRedirect(
                this.display.matchEndState(),
                {
                    endRedirectRemainingMs: this.endRedirectRemainingMs,
                    interaction: this.interaction,
                    matchState: this.matchState,
                    router: this.router,
                    state: this.matchEndRedirectState,
                },
            );
        });
    }

    ngOnInit(): void {
        this.localPoseIntervalId = startLocalPoseRefreshClock(this.nowMs, GameViewPageComponent.localPoseRefreshMs);

        const sessionId = this.route.snapshot.queryParamMap.get('sessionId');
        const localPlayer = this.display.localPlayer();
        if (!sessionId || !localPlayer) {
            this.matchState.errorMessage.set('Impossible de joindre la session multijoueur.');
            this.matchState.state.set('error');
            return;
        }

        this.matchState.state.set('loading');
        this.chatService.clearChat();
        const navigationMessages = (history.state?.messages ?? []) as ChatMessage[];
        this.chatService.loadChatMessages(navigationMessages);
        this.gameSessionSocket.joinSession(sessionId, localPlayer.id);
        this.chatService.initChat();
    }

    ngOnDestroy(): void {
        this.chatService.unsubscribeToSocketEvents();
        this.effects.destroy();
        this.localPoseIntervalId = stopLocalPoseRefreshClock(this.localPoseIntervalId);
        this.matchEndRedirectState = clearMatchEndRedirect(this.matchEndRedirectState, this.endRedirectRemainingMs);
    }

    protected endRedirectCountdownSeconds(): number {
        return Math.max(0, Math.ceil(this.endRedirectRemainingMs() / MILLISECONDS_PER_SECOND));
    }

    protected phaseHeadline(): string {
        return getPhaseHeadline(
            this.display.turnState(),
            this.display.currentActivePlayer()?.name ?? null,
            this.display.transitionTargetPlayer()?.name ?? null,
            this.display.transitionCountdownSeconds(),
        );
    }

    protected phaseDescription(): string {
        return getPhaseDescription(
            this.display.turnState(),
            this.display.transitionTargetPlayer()?.name ?? null,
            this.display.localMovementPointsRemaining(),
            this.display.localActionAvailable(),
        );
    }

    protected onCellClick(index: number): void {
        const tile = this.mapCells()[index];
        if (tile) {
            this.interaction.handleCellPrimaryAction(tile);
        }
    }

    protected onCellContextMenu(payload: { event: MouseEvent; index: number }): void {
        const tile = this.mapCells()[payload.index];
        if (tile) {
            this.interaction.inspectTile(payload.event, tile);
        }
    }

    protected onEndTurn(): void {
        this.interaction.endCurrentTurn();
    }

    protected onChatMessageSubmit(content: string): void {
        const author = this.currentPlayer()?.information?.name;
        if (!author) {
            return;
        }

        const message: ChatMessage = {
            ...buildChatMessage(author, content),
        };
        this.chatService.sendMessage(message);
    }

    protected onToggleActionMode(): void {
        this.interaction.toggleActionMode();
    }

    protected onTogglePlayerListExpanded(): void {
        this.isPlayerListExpanded.update((expanded) => !expanded);
    }

    protected closeTileInfoModal(): void {
        this.interaction.closeInspection();
    }

    protected onToggleTurnStatusPanel(): void {
        this.isTurnStatusPanelOpen.update((open) => !open);
    }

    protected acceptIncomingFlagTransfer(): void {
        const localPlayerId = this.localPlayerId();
        if (!localPlayerId || !this.incomingFlagTransfer()) {
            return;
        }

        this.gameSessionSocket.resolveFlagTransfer(localPlayerId, true);
        this.interaction.movementFeedback.set('Transfert du drapeau accepte.');
    }

    protected refuseIncomingFlagTransfer(): void {
        const localPlayerId = this.localPlayerId();
        if (!localPlayerId || !this.incomingFlagTransfer()) {
            return;
        }

        this.gameSessionSocket.resolveFlagTransfer(localPlayerId, false);
        this.interaction.movementFeedback.set('Transfert du drapeau refuse.');
    }

    protected onToggleDebugMode(): void {
        const localPlayerId = this.localPlayerId();
        if (!localPlayerId || !this.canToggleDebugMode() || this.display.matchEndState()) return;
        this.gameSessionSocket.toggleDebugMode(localPlayerId);
    }

    @HostListener('window:keyup', ['$event'])
    protected handleMovementKeyup(event: KeyboardEvent): void {
        this.interaction.handleMovementKeyup(event);
    }

    @HostListener('window:keydown', ['$event'])
    protected handleDebugShortcut(event: KeyboardEvent): void {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) {
            return;
        }

        const target = event.target;
        if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
            return;
        }

        if (event.key === 'Escape') {
            if (this.selectedTileInfo()) {
                event.preventDefault();
                this.closeTileInfoModal();
            }
            return;
        }

        if (event.key.toLowerCase() !== 'm' || !this.canToggleDebugMode() || this.display.matchEndState()) return;

        event.preventDefault();
        this.onToggleDebugMode();
    }

    @HostListener('window:beforeunload')
    protected handleBrowserRefresh(): void {
        if (!this.display.localPlayer()) {
            return;
        }

        const message = this.display.matchEndState()?.message ??
            'Rafraichissement detecte: la partie a ete consideree comme un abandon.';
        this.leaveMatch(message);
    }

    protected quitGame(): void {
        this.matchEndRedirectState = clearMatchEndRedirect(this.matchEndRedirectState, this.endRedirectRemainingMs);
        this.interaction.clearActionSelection();
        this.leaveMatch('Vous avez abandonne la partie. Retour a l accueil.');
        void this.router.navigate(['/home']);
    }

    private leaveMatch(message: string): void {
        const localPlayer = this.display.localPlayer();
        if (localPlayer) {
            this.gameSessionSocket.surrender(localPlayer.id);
        }

        if (this.display.matchEndState()) {
            this.matchState.endLocalSession(message);
            return;
        }

        this.matchState.abandonLocalPlayer(message);
    }
}
