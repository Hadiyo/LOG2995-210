import { Injectable, computed } from '@angular/core';
import {
  canForceEndTurnInDebugMode,
  canTeleportInDebugMode,
  canToggleDebugMode,
  canUseDebugTeleportRightClick,
  getCurrentDebugPlayer,
} from '@app/services/game/debug/game-debug.utils';
import { LocalGameStateService } from '@app/services/game/local-game-state.service';
import { GameCell } from '@common/maps/map.interface';
import { Player } from '@common/player/player.interface';

@Injectable({
  providedIn: 'root',
})
export class GameDebugService {
  // Reuse the session snapshot so debug mode stays in shared game state.
  readonly session = this.localGameStateService.session;
  readonly currentPlayerId = this.localGameStateService.currentPlayerId;
  // Expose the current debug mode as a computed signal for UI consumers.
  readonly isDebugModeEnabled = computed<boolean>(() => this.session()?.debugMode ?? false);
  // Resolve the current player through the shared debug utility.
  readonly currentPlayer = computed<Player | null>(() =>
    getCurrentDebugPlayer(this.session(), this.currentPlayerId()),
  );
  // Reuse the organizer guard from the shared debug utility.
  readonly canToggleDebugMode = computed<boolean>(() => canToggleDebugMode(this.session(), this.currentPlayerId()));
  // Expose whether the organizer can force the current turn to end in debug mode.
  readonly canForceEndTurn = computed<boolean>(() => canForceEndTurnInDebugMode(this.session(), this.currentPlayerId()));
  // Expose whether right click should teleport instead of opening tile info.
  readonly usesTeleportRightClick = computed<boolean>(() => canUseDebugTeleportRightClick(this.session(), this.currentPlayerId()));

  constructor(private readonly localGameStateService: LocalGameStateService) {}

  toggleDebugMode(): void {
    if (!this.canToggleDebugMode()) return;
    this.localGameStateService.toggleDebugMode();
  }

  // End the active player's turn through the local runtime while debug mode is active.
  forceEndTurn(): void {
    if (!this.canForceEndTurn()) return;
    this.localGameStateService.forceEndTurnInDebugMode();
  }

  // Reuse the shared debug teleport rules for right-click interactions.
  canTeleportToCell(targetCell: GameCell | undefined): boolean {
    return canTeleportInDebugMode(this.session(), this.currentPlayerId(), targetCell);
  }

  // Delegate the actual local teleport mutation to the local game state service.
  teleportToCell(targetIndex: number): void {
    this.localGameStateService.teleportToCellInDebugMode(targetIndex);
  }
}
