import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CharacterSpriteComponent } from '@app/components/game/character-sprite/character-sprite.component';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { TileType } from '@common/maps/map.enums';
import { GameCell, MapObject } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';

// Used to vary breathing animation delay across players (avoid sync look).
const BREATHING_DELAY_VARIANTS = 5;
// Delay step in seconds.
const BREATHING_DELAY_STEP_SECONDS = 0.2;

@Component({
  selector: 'app-game-map-grid',
  standalone: true,
  imports: [CommonModule, CharacterSpriteComponent],
  templateUrl: './game-map-grid.component.html',
  styleUrl: './game-map-grid.component.scss',
})
export class GameMapGridComponent {
  // Grid geometry (required from parent).
  @Input({ required: true }) cols!: number;
  @Input({ required: true }) rows!: number;

  // Main map cells list.
  @Input({ required: true }) cells: readonly GameCell[] = [];
  // Optional map objects placed on tiles.
  @Input() objects: readonly MapObject[] = [];
  // Current players list.
  @Input() players: readonly Player[] = [];
  // Optional per-player direction overrides (dev/runtime).
  @Input() playerDirections: Readonly<Record<string, CharacterDirection>> = {};
  // Optional per-player state overrides (dev/runtime).
  @Input() playerStates: Readonly<Record<string, CharacterState>> = {};
  // Local render clock used to expire transient poses client-side.
  @Input() nowMs = 0;
  // Toggles action-mode cursor style.
  @Input() actionModeEnabled = false;
  // Emits tile index when user clicks a cell.
  @Output() cellClick = new EventEmitter<number>();

  // Expose enum to template.
  readonly tileType = TileType;
  readonly defaultPlayerState: CharacterState = 'idle';
  readonly deadPlayerState: CharacterState = 'dead';
  readonly defaultPlayerDirection: CharacterDirection = 'front';

  // Forward clicked cell index to parent.
  onCellClick(index: number): void {
    this.cellClick.emit(index);
  }

  // Find player occupying this exact cell.
  getPlayerAtCell(cell: GameCell): Player | null {
    return this.players.find((player) =>
      player.state.position?.x === cell.position.x && player.state.position?.y === cell.position.y) ?? null;
  }

  // Find map object on this exact cell.
  getObjectAtCell(cell: GameCell): MapObject | null {
    return this.objects.find((object) =>
      object.position.x === cell.position.x && object.position.y === cell.position.y) ?? null;
  }

  // Fallback avatar id if missing.
  getAvatarId(player: Player): number {
    return player.information.avatarId ?? 0;
  }

  // Dead players force dead pose; otherwise use override or idle.
  getPlayerState(player: Player): CharacterState {
    if (player.state.status === PlayerStatus.Eliminated) return this.deadPlayerState;
    const localOverride = this.playerStates[player.id];
    if (localOverride) return localOverride;

    const pose = player.render?.pose ?? this.defaultPlayerState;
    if (this.isTransientPoseExpired(player, pose)) return this.defaultPlayerState;

    return pose;
  }

  // Direction override or front by default.
  getPlayerDirection(player: Player): CharacterDirection {
    return this.playerDirections[player.id] ?? player.render?.facing ?? this.defaultPlayerDirection;
  }

  // Deterministic pseudo-random delay from playerId for desynced idle breathing.
  getBreathingDelay(playerId: string): string {
    const hash = Array.from(playerId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const delay = (hash % BREATHING_DELAY_VARIANTS) * BREATHING_DELAY_STEP_SECONDS;
    return `${delay}s`;
  }

  // Helper to identify if a pose is expired based on server timestamp and duration.
  private isTransientPoseExpired(player: Player, pose: CharacterState): boolean {
    if (pose !== 'walk' && pose !== 'attack') return false;
    if (!player.render?.poseStartedAt || !player.render?.poseDurationMs) return false;

    const startedAtMs = Date.parse(player.render?.poseStartedAt);
    if (Number.isNaN(startedAtMs)) return false;
    return this.nowMs >= startedAtMs + player.render?.poseDurationMs;
  }
}
