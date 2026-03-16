import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameActionBarComponent } from '@app/components/game/game-action-bar/game-action-bar.component';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { GameCurrentPlayerPanelComponent } from '@app/components/game/game-current-player-panel/game-current-player-panel.component';
import { GameMapGridComponent } from '@app/components/game/game-map-grid/game-map-grid.component';
import { GamePlayerListComponent } from '@app/components/game/game-player-list/game-player-list.component';
import { GameSessionInfoPanelComponent } from '@app/components/game/game-session-info-panel/game-session-info-panel.component';
import { GameTileInfoModalComponent } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.component';
import { MAP_SIZE_CONFIG } from '@app/config/map.config';
import { GameDebugService } from '@app/services/game/debug/game-debug.service';
import { GameTileInfoService } from '@app/services/game/game-tile-info.service';
import { GameVisualFeedbackService } from '@app/services/game/game-visual-feedback.service';
//import { GAME_STORAGE_KEYS, GameStateService } from '@app/services/game/game-state.service';
// TODO: use GameStateService when backend gameplay runtime is restored. 
// LocalGameStateService is a temporary static-mode implementation.
import { GAME_STORAGE_KEYS, LocalGameStateService } from '@app/services/game/local-game-state.service';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { GameActionType } from '@common/game/game-session.interface';
import { MapSize } from '@common/maps/map.enums';
import { GameCell, MapObject } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';
import { take } from 'rxjs';
import {
  getDirectionToTarget,
  getManhattanDistance,
  isLikelyValidAction,
  resolveActionTypeForCell,
} from './game-view-action.utils';
import {
  ADJACENT_TILE_DISTANCE,
  ATTACK_VISUAL_MS,
  GAME_END_REDIRECT_DELAY_MS,
  GAME_VIEW_CONSTANTS,
  LOCAL_POSE_REFRESH_MS,
  WALK_VISUAL_MS,
} from './game-view.constants';

// TODO(refactor): 
// This component has become a dumping ground for various game view related logic. 
// As the gameplay code stabilizes, we should split responsibilities into focused services. For example:
// - GameViewTileInteractionService: left/right click routing, debug teleport, tile info open/close, click feedback.
// - GameViewAvatarService: panel avatar id/state/direction derivation and transient pose expiration logic.
// - GameViewLifecycleService: session bootstrap, game-end redirect, local pose refresh clock, page cleanup.
// - ...
// I don't wanna do it right now as others are possibly working on this component and I don't want to cause any further merge conflicts, 
// but it should be on the roadmap for the next refactor pass. 
@Component({
  selector: 'app-game-view-page',
  standalone: true,
  imports: [
    CommonModule,
    GameMapGridComponent,
    GamePlayerListComponent,
    GameActionBarComponent,
    GameChatPanelComponent,
    GameSessionInfoPanelComponent,
    GameCurrentPlayerPanelComponent,
    GameTileInfoModalComponent,
  ],
  templateUrl: './game-view-page.component.html',
  styleUrls: ['./game-view-page.component.scss'],
})

// Main game view page component displaying map, players, and game UI
export class GameViewPageComponent implements OnInit, OnDestroy {
  // Keep tile info modal state outside the page to reduce local UI plumbing.
  private readonly gameTileInfoService = inject(GameTileInfoService);

  readonly constants = GAME_VIEW_CONSTANTS;

  // Session data from game state service
  readonly session = this.gameStateService.session;

  // Computed map properties (cells, objects, dimensions)
  readonly mapCells = computed<readonly GameCell[]>(() => this.session()?.map.map ?? []);
  readonly mapObjects = computed<readonly MapObject[]>(() => this.session()?.map.objects ?? []);
  readonly cols = computed<number>(() => {
    return this.session()?.map.size ?? this.constants.minGridDimension;
  });
  readonly rows = computed<number>(() => {
    return this.session()?.map.size ?? this.constants.minGridDimension;
  });

  // Player-related computeds
  readonly players = computed<readonly Player[]>(() => this.session()?.players ?? []);
  readonly activePlayersCount = computed<number>(() =>
    this.players().filter((player) => player.state.status === PlayerStatus.Active).length,
  );
  readonly maxPlayers = computed<number>(() => {
    const size = this.session()?.map.size;
    if (!size) return 0;
    const config = MAP_SIZE_CONFIG.find((option) => option.value === (size as MapSize));
    return config?.maxPlayers ?? 0;
  });

  // Turn and action tracking
  readonly turnOrder = computed<readonly string[]>(() => this.session()?.turn.order ?? []);
  readonly activeNotification = this.gameStateService.activeNotification;
  // Debug mode and permissions
  readonly isDebugModeEnabled = this.gameDebugService.isDebugModeEnabled;
  readonly canForceEndTurn = this.gameDebugService.canForceEndTurn;
  // Game end tracking
  readonly isSessionEnded = computed<boolean>(() => {
    const currentSession = this.session();
    if (!currentSession) return false;
    return currentSession.turn.phase === 'TRANSITION' && currentSession.turn.activePlayerId === '';
  });
  readonly activePlayerId = computed<string>(() => this.session()?.turn.activePlayerId ?? '');
  readonly currentPlayerId = this.gameStateService.currentPlayerId;

  // Current and active player references
  readonly activePlayer = computed<Player | null>(() =>
    this.players().find((player) => player.id === this.activePlayerId()) ?? null,
  );
  readonly currentPlayer = computed<Player | null>(() =>
    this.players().find((player) => player.id === this.currentPlayerId()) ?? null,
  );

  // Action permission checks
  readonly isCurrentPlayersTurn = computed<boolean>(() => {
    const currentPlayer = this.currentPlayer();
    if (!currentPlayer) return false;
    if (currentPlayer.state.status !== PlayerStatus.Active) return false;
    return this.activePlayerId() === currentPlayer.id;
  });
  readonly canUseActionMode = computed<boolean>(() => {
    if (!this.isCurrentPlayersTurn()) return false;
    return (this.currentPlayer()?.state.remainingActions ?? 0) > 0;
  });
  // Let the organizer use the end-turn button in debug mode even outside their own turn.
  readonly canEndTurn = computed<boolean>(() => this.isCurrentPlayersTurn() || this.canForceEndTurn());

  // Local visual override signals (used for responsive click feedback).
  readonly playerDirections = this.gameVisualFeedbackService.playerDirections;
  readonly playerStates = this.gameVisualFeedbackService.playerStates;

  // Local UI state signals
  readonly actionModeEnabled = signal(false);
  readonly isPlayerListExpanded = signal(false);
  // Use the shared tile info modal state managed by the dedicated service.
  readonly selectedTileInfo = this.gameTileInfoService.selectedTileInfo;
  readonly errorMessage = signal('');
  readonly nowMs = signal(Date.now()); // Updated periodically for transient pose timing

  // Avatar appearance constants
  readonly avatarState: CharacterState = 'idle';
  readonly avatarDirection: CharacterDirection = 'front';

  // Interval ID for local pose refresh clock
  private localPoseIntervalId: ReturnType<typeof setInterval> | null = null;
  // Prevents multiple game-end navigation attempts
  private hasHandledGameEndNavigation = false;

  // Computed panel avatar state and direction based on character pose
  readonly panelAvatarId = computed<number>(() => this.currentPlayer()?.information.avatarId ?? 0);
  readonly panelAvatarState = computed<CharacterState>(() => {
    this.nowMs();
    const player = this.currentPlayer();
    if (!player) return this.avatarState;
    if (player.state.status === PlayerStatus.Eliminated) return 'dead';

    const localOverride = this.playerStates()[player.id];
    if (localOverride) return localOverride;

    const pose = player?.render?.pose ?? this.avatarState;
    if (this.isTransientPoseExpired(player, pose)) return this.avatarState;
    return pose;
  });
  readonly panelAvatarDirection = computed<CharacterDirection>(() => {
    const player = this.currentPlayer();
    if (!player) return this.avatarDirection;
    return this.playerDirections()[player.id] ?? player.render?.facing ?? this.avatarDirection;
  });

  constructor(
    //private readonly gameStateService: GameStateService,
    // TODO: inject local static-mode state service.
    // Swap back to GameStateService when backend gameplay runtime is restored.
    private readonly gameStateService: LocalGameStateService,
    private readonly gameDebugService: GameDebugService,
    private readonly gameVisualFeedbackService: GameVisualFeedbackService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    // Effect: redirect to home when game session ends
    effect(() => {
      if (!this.isSessionEnded()) return;
      if (this.hasHandledGameEndNavigation) return;

      this.hasHandledGameEndNavigation = true;
      setTimeout(() => {
        void this.router.navigate(['/home']);
      }, GAME_END_REDIRECT_DELAY_MS);
    });
  }

  // Listen to the M shortcut and delegate the toggle to the debug service.
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target;
    // Ignore shortcuts while the user is typing in chat or any editable field.
    if (target instanceof HTMLElement) {
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return;
    }

    // Escape closes the tile information modal if it is open.
    if (event.key === 'Escape' && this.selectedTileInfo()) {
      event.preventDefault();
      this.closeTileInfoModal();
      return;
    }

    if (event.repeat) return;
    if (event.key.toLowerCase() !== 'm') return;

    event.preventDefault();
    this.gameDebugService.toggleDebugMode();
  }

  // Initialize game session from route params or localStorage
  ngOnInit(): void {
    this.gameVisualFeedbackService.resetVisualOverrides();
    this.startLocalPoseRefreshClock();

    const sessionId = this.route.snapshot.queryParamMap.get('sessionId') ?? localStorage.getItem(GAME_STORAGE_KEYS.sessionId);
    const playerId = this.route.snapshot.queryParamMap.get('playerId') ?? localStorage.getItem(GAME_STORAGE_KEYS.playerId);

    if (!sessionId || !playerId) {
      this.errorMessage.set('Aucune session active trouvée.');
      return;
    }

    this.gameStateService
      .loadSession(sessionId, playerId)
      .pipe(take(1))
      .subscribe({
        error: () => this.errorMessage.set('Impossible de charger la session de jeu.'),
      });
  }

  // Cleanup: stop timers, leave session, reset local visual overrides.
  ngOnDestroy(): void {
    this.stopLocalPoseRefreshClock();
    this.gameVisualFeedbackService.resetVisualOverrides();
    this.gameStateService.leaveCurrentSession();
  }

  // End the current player's turn (server-side)
  onEndTurn(): void {
    // Route organizer-triggered debug end-turn through the dedicated debug service.
    if (this.canForceEndTurn() && !this.isCurrentPlayersTurn()) {
      this.gameDebugService.forceEndTurn();
      return;
    }
    if (!this.isCurrentPlayersTurn()) return;
    this.gameStateService.endTurn();
  }

  // Toggle action mode (attack/interact) on/off
  onToggleActionMode(): void {
    if (!this.canUseActionMode()) return;
    const nextState = !this.actionModeEnabled();
    this.actionModeEnabled.set(nextState);
  }

  // Toggle expansion state of player list panel
  onTogglePlayerListExpanded(): void {
    this.isPlayerListExpanded.set(!this.isPlayerListExpanded());
  }

  // Handle map cell click: resolve action type and execute if valid
  onCellClick(index: number): void {
    if (!this.canCurrentPlayerAct()) return;

    const actionType = resolveActionTypeForCell({
      actionModeEnabled: this.actionModeEnabled(),
      cellIndex: index,
      mapCells: this.mapCells(),
      players: this.players(),
      currentPlayerId: this.currentPlayerId(),
    });

    if (
      !isLikelyValidAction({
        cellIndex: index,
        actionType,
        mapCells: this.mapCells(),
        players: this.players(),
        currentPlayer: this.currentPlayer(),
        adjacentTileDistance: ADJACENT_TILE_DISTANCE,
      })
    ) {
      return;
    }

    this.applyClickVisualFeedback(index, actionType);
    this.gameStateService.executeAction(index, actionType);

    if (this.actionModeEnabled()) {
      this.actionModeEnabled.set(false);
    }
  }

  // Right click teleports the active player to a free tile while debug mode is enabled.
  onCellRightClick(index: number): void {
    const targetCell = this.mapCells()[index];
    // Keep right click reserved for teleportation during the organizer debug turn.
    if (this.gameDebugService.usesTeleportRightClick()) {
      if (this.gameDebugService.canTeleportToCell(targetCell)) {
        this.applyTeleportVisualDirection(targetCell);
        this.gameDebugService.teleportToCell(index);
      }
      return;
    }

    this.openTileInfoModal(index);
  }

  // Surrender the game and return to home page
  onSurrender(): void {
    this.gameStateService.surrender();
    void this.router.navigate(['/home']);
  }

  // Submit a chat message to the session
  onChatMessageSubmit(content: string): void {
    this.gameStateService.sendMessage(content);
  }

  // Close the tile information modal.
  closeTileInfoModal(): void {
    this.gameTileInfoService.closeTileInfo();
  }

  // Check if the current player can perform actions
  private canCurrentPlayerAct(): boolean {
    return this.isCurrentPlayersTurn();
  }

  // Build the modal payload for the clicked cell and open it.
  private openTileInfoModal(index: number): void {
    this.gameTileInfoService.openTileInfo(this.mapCells()[index], this.mapObjects(), this.players());
  }

  // Keep the local visual override in sync with debug teleport direction changes.
  private applyTeleportVisualDirection(targetCell: GameCell | undefined): void {
    const currentPlayer = this.currentPlayer();
    if (!currentPlayer?.state.position || !targetCell) return;

    const direction = getDirectionToTarget(
      currentPlayer.state.position.x,
      currentPlayer.state.position.y,
      targetCell.position.x,
      targetCell.position.y,
    );
    if (!direction) return;

    this.gameVisualFeedbackService.setVisualDirection(currentPlayer.id, direction);
  }

  // Apply visual feedback (direction and pose animation) for click action
  private applyClickVisualFeedback(cellIndex: number, actionType: GameActionType): void {
    const currentPlayer = this.currentPlayer();
    const targetCell = this.mapCells()[cellIndex];
    if (!currentPlayer?.state.position || !targetCell) return;

    // Set player facing direction
    const direction = getDirectionToTarget(
      currentPlayer.state.position.x,
      currentPlayer.state.position.y,
      targetCell.position.x,
      targetCell.position.y,
    );

    if (!direction) return;
    this.gameVisualFeedbackService.setVisualDirection(currentPlayer.id, direction);

    // Set transient pose (walk/attack animation) only for adjacent tiles
    const distance = getManhattanDistance(
      currentPlayer.state.position.x,
      currentPlayer.state.position.y,
      targetCell.position.x,
      targetCell.position.y,
    );
    if (distance !== ADJACENT_TILE_DISTANCE) return;

    if (actionType === 'MOVE') {
      this.gameVisualFeedbackService.setVisualTransientState(currentPlayer.id, 'walk', WALK_VISUAL_MS);
      return;
    }

    this.gameVisualFeedbackService.setVisualTransientState(currentPlayer.id, 'attack', ATTACK_VISUAL_MS);
  }

  // Start interval timer for updating character pose state
  private startLocalPoseRefreshClock(): void {
    this.stopLocalPoseRefreshClock();
    this.localPoseIntervalId = setInterval(() => {
      this.nowMs.set(Date.now());
    }, LOCAL_POSE_REFRESH_MS);
  }

  // Stop and cleanup pose refresh interval
  private stopLocalPoseRefreshClock(): void {
    if (!this.localPoseIntervalId) return;
    clearInterval(this.localPoseIntervalId);
    this.localPoseIntervalId = null;
  }

  // Check if transient pose (walk/attack) has expired based on elapsed time
  private isTransientPoseExpired(player: Player, pose: CharacterState): boolean {
    if (pose !== 'walk' && pose !== 'attack') return false;
    if (!player.render?.poseStartedAt || !player.render?.poseDurationMs) return false;

    const startedAtMs = Date.parse(player.render?.poseStartedAt);
    if (Number.isNaN(startedAtMs)) return false;
    return this.nowMs() >= startedAtMs + player.render?.poseDurationMs;
  }
}
