import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { GameCombatPanelComponent } from '@app/components/game/game-combat-panel/game-combat-panel.component';
import { GameCombatWaitingPanelComponent } from '@app/components/game/game-combat-waiting-panel/game-combat-waiting-panel.component';
import { GameMapActionPromptComponent } from '@app/components/game/game-map-action-prompt/game-map-action-prompt.component';
import { GameMapGridComponent } from '@app/components/game/game-map-grid/game-map-grid.component';
import { GameTileInfoModalComponent } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.component';
import { GameViewLeftSidebarComponent } from '@app/components/game/game-view-left-sidebar/game-view-left-sidebar.component';
import { GameViewOverlaysComponent } from '@app/components/game/game-view-overlays/game-view-overlays.component';
import { GameViewRightSidebarComponent } from '@app/components/game/game-view-right-sidebar/game-view-right-sidebar.component';
import { GameViewTurnStatusOverlayComponent } from '@app/components/game/game-view-turn-status-overlay/game-view-turn-status-overlay.component';
import { ACTIVE_TURN_DURATION_MS, MILLISECONDS_PER_SECOND, TRANSITION_DURATION_MS } from '@app/config/game-session.config';
import { GAME_VIEW_CONSTANTS } from '@app/config/game-view.config';
import { MAP_SIZE_CONFIG } from '@app/config/map.config';
import { ChatService } from '@app/services/chat/chat.service';
import { EndStatsService } from '@app/services/end-stats/end-stats.service';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { GameSessionDisplayService } from '@app/services/game-view/game-session-display.service';
import { GameSessionInteractionService } from '@app/services/game-view/game-session-interaction.service';
import { GameSessionTargetsService } from '@app/services/game-view/game-session-targets.service';
import { GameSessionTurnEffectsService } from '@app/services/game-view/game-session-turn-effects.service';
import { CombatStateService } from '@app/services/match/combat-state.service';
import { positionKey } from '@app/services/match/match-geometry';
import { MatchStateService } from '@app/services/match/match-state.service';
import { createPanelAvatarDirection, createPanelAvatarId, createPanelAvatarState } from '@app/utils/game-view/game-view-avatar.utils';
import { getPhaseDescription, getPhaseHeadline } from '@app/utils/game-view/game-view-phase.utils';
import { toGamePlayer } from '@app/utils/game-view/game-view-player.utils';
import { createSelectedTileInfo } from '@app/utils/game-view/game-view-tile-info.utils';
import { ChatMessage } from '@common/chat/chat.interface';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { MapSize } from '@common/maps/map.enums';
import { GameCell } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';
import {
    buildChatMessage, buildIncomingFlagTransfer,
    clearMatchEndRedirect,
    destroyGameViewPage,
    handleGameViewBrowserRefresh, handleGameViewCellClick,
    handleGameViewCellContextMenu,
    handleGameViewDebugShortcut,
    handleGameViewEndTurn,
    handleGameViewMovementKeyup,
    handleGameViewToggleActionMode,
    handleGameViewToggleDebugMode,
    handleIncomingFlagTransferResponse,
    initializeGameViewPage,
    leaveMatch,
    syncMatchEndRedirect,
} from './game-view-page.helpers';
import { GameViewCellContextMenuPayload, MatchEndRedirectState } from './game-view-page.helpers.interfaces';
@Component({
    selector: 'app-game-view-page',
    standalone: true,
    imports: [
        CommonModule,
        GameMapGridComponent,
        GameCombatPanelComponent,
        GameCombatWaitingPanelComponent,
        GameMapActionPromptComponent,
        GameTileInfoModalComponent,
        GameViewLeftSidebarComponent,
        GameViewOverlaysComponent,
        GameViewRightSidebarComponent,
        GameViewTurnStatusOverlayComponent,
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
    protected readonly combat = inject(CombatStateService);
    private readonly matchState = inject(MatchStateService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly gameSessionSocket = inject(GameSessionSocketService);
    private readonly chatService = inject(ChatService);
    private readonly endStatsService = inject(EndStatsService);

    protected readonly endRedirectRemainingMs = signal(0);
    protected readonly errorMessage = computed(() => this.gameSessionSocket.errorMessage() || this.display.errorMessage());
    protected readonly match = this.display.match;
    protected readonly messageTab = signal<'chat' | 'journal'>('chat');
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
    protected readonly activePlayer = computed<Player | null>(() => this.players().find((player) => player.id === this.activePlayerId()) ?? null);
    protected readonly currentPlayer = computed<Player | null>(() => this.players().find((player) => player.id === this.localPlayerId()) ?? null);
    protected readonly panelAvatarId = createPanelAvatarId(this.currentPlayer);
    protected readonly panelAvatarState = createPanelAvatarState(this.currentPlayer, this.nowMs);
    protected readonly panelAvatarDirection = createPanelAvatarDirection(this.currentPlayer);
    protected readonly activePlayersCount = computed<number>(
        () => this.players().filter((player) => player.state.status === PlayerStatus.Active).length,
    );
    protected readonly debugModeEnabled = computed<boolean>(() => this.match()?.debugMode ?? false);
    protected readonly canToggleDebugMode = computed<boolean>(() => this.currentPlayer()?.information.isOrganizer ?? false);
    protected readonly hasLocalPendingSanctuaryChoice = computed<boolean>(() => this.interaction.hasLocalPendingSanctuaryChoice());
    protected readonly canEndTurn = computed<boolean>(() =>
        !this.combat.hasActiveCombat() &&
        !this.hasLocalPendingSanctuaryChoice() &&
        (this.canAct() || (this.debugModeEnabled() && (this.currentPlayer()?.information.isOrganizer ?? false))),
    );
    protected readonly canAct = computed<boolean>(() =>
        !this.combat.hasActiveCombat() &&
        this.targets.isLocalPlayerTurn() &&
        !this.display.matchEndState() &&
        !this.hasLocalPendingSanctuaryChoice(),
    );
    protected readonly canUseActionMode = computed<boolean>(() =>
        !this.combat.hasActiveCombat() && !this.hasLocalPendingSanctuaryChoice() && this.interaction.canToggleActionMode(),
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
    protected readonly activePanelName = computed<string | null>(() => {
        const turnState = this.display.turnState();
        if (!turnState) {
            return null;
        }
        if (turnState.phase === 'active') {
            return this.display.currentActivePlayer()?.name ?? null;
        }
        return this.display.transitionTargetPlayer()?.name ?? null;
    });
    protected readonly reachableCellKeys = computed<ReadonlySet<string>>(() => new Set<string>(this.display.reachableTiles().keys()));
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
    protected readonly journalEntries = computed<readonly GameLogEntry[]>(() => this.gameSessionSocket.logEntries());
    protected readonly journalAvailable = computed<boolean>(() => this.display.turnState()?.hasStarted ?? false);
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
        effect(() => {
            if (!this.journalAvailable() && this.messageTab() === 'journal') {
                this.messageTab.set('chat');
            }
        });
    }
    ngOnInit(): void {
        this.combat.closeCombat();
        this.localPoseIntervalId = initializeGameViewPage({
            chatService: this.chatService,
            endStatsService: this.endStatsService,
            display: this.display,
            gameSessionSocket: this.gameSessionSocket,
            localPoseRefreshMs: GameViewPageComponent.localPoseRefreshMs,
            matchState: this.matchState,
            navigationMessages: (history.state?.messages ?? []) as ChatMessage[],
            nowMs: this.nowMs,
            sessionId: this.route.snapshot.queryParamMap.get('sessionId'),
        });
    }
    ngOnDestroy(): void {
        this.matchEndRedirectState = destroyGameViewPage({
            chatService: this.chatService,
            endStatsService: this.endStatsService,
            combat: this.combat,
            effects: this.effects,
            endRedirectRemainingMs: this.endRedirectRemainingMs,
            localPoseIntervalId: this.localPoseIntervalId,
            matchEndRedirectState: this.matchEndRedirectState,
        });
        this.localPoseIntervalId = null;
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
        handleGameViewCellClick(this.combat.hasActiveCombat(), this.interaction, this.mapCells(), index);
    }
    protected onCellContextMenu(payload: GameViewCellContextMenuPayload): void {
        handleGameViewCellContextMenu(this.combat.hasActiveCombat(), this.interaction, this.mapCells(), payload);
    }
    protected onEndTurn(): void {
        handleGameViewEndTurn(this.combat.hasActiveCombat(), this.interaction);
    }
    protected onChatMessageSubmit(content: string): void {
        const author = this.currentPlayer()?.information?.name;
        if (!author) return;
        this.chatService.sendMessage(buildChatMessage(author, content));
    }
    protected onToggleActionMode(): void {
        handleGameViewToggleActionMode(this.combat.hasActiveCombat(), this.interaction);
    }
    protected onMessageTabChange(tab: 'chat' | 'journal'): void {
        if (tab === 'journal' && !this.journalAvailable()) return;
        this.messageTab.set(tab);
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
        handleIncomingFlagTransferResponse(true, this.incomingFlagTransfer(), this.localPlayerId(), this.gameSessionSocket, this.interaction);
    }
    protected refuseIncomingFlagTransfer(): void {
        handleIncomingFlagTransferResponse(false, this.incomingFlagTransfer(), this.localPlayerId(), this.gameSessionSocket, this.interaction);
    }
    protected onToggleDebugMode(): void {
        handleGameViewToggleDebugMode(
            this.localPlayerId(),
            this.canToggleDebugMode(),
            !!this.display.matchEndState(),
            this.gameSessionSocket,
        );
    }
    @HostListener('window:keyup', ['$event'])
    protected handleMovementKeyup(event: KeyboardEvent): void {
        handleGameViewMovementKeyup(event, this.combat.hasActiveCombat(), this.interaction);
    }
    @HostListener('window:keydown', ['$event'])
    protected handleDebugShortcut(event: KeyboardEvent): void {
        handleGameViewDebugShortcut(event, {
            canToggleDebugMode: this.canToggleDebugMode(),
            closeTileInfoModal: () => this.closeTileInfoModal(),
            combatActive: this.combat.hasActiveCombat(),
            combatClose: () => this.combat.closeCombat(),
            matchEnded: !!this.display.matchEndState(),
            onToggleDebugMode: () => this.onToggleDebugMode(),
            selectedTileInfo: this.selectedTileInfo(),
        });
    }
    @HostListener('window:beforeunload')
    protected handleBrowserRefresh(): void {
        handleGameViewBrowserRefresh(
            !!this.display.localPlayer(),
            (message) => this.leaveMatch(message),
            this.display.matchEndState()?.message ?? null,
        );
    }
    protected quitGame(): void {
        this.matchEndRedirectState = clearMatchEndRedirect(this.matchEndRedirectState, this.endRedirectRemainingMs);
        this.interaction.clearActionSelection();
        leaveMatch("Vous avez abandonné la partie. Retour a l'accueil.", {
            display: this.display,
            gameSessionSocket: this.gameSessionSocket,
            matchState: this.matchState,
        });
        void this.router.navigate(['/home']);
    }
    private leaveMatch(message: string): void {
        leaveMatch(message, {
            display: this.display,
            gameSessionSocket: this.gameSessionSocket,
            matchState: this.matchState,
        });
    }
}
