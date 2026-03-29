import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CharacterSpriteComponent } from '@app/components/game/character-sprite/character-sprite.component';
import { getTeamClass } from '@app/components/game/team-class.util';
import { positionKey } from '@app/services/match/match-geometry';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { TileType } from '@common/maps/map.enums';
import { GameCell, MapObject } from '@common/maps/map.interface';
import { Player, PlayerFacing, PlayerPose, PlayerStatus } from '@common/player/player.interface';

const BREATHING_DELAY_VARIANTS = 5;
const BREATHING_DELAY_STEP_SECONDS = 0.2;

@Component({
  selector: 'app-game-map-grid',
  standalone: true,
  imports: [CommonModule, CharacterSpriteComponent],
  templateUrl: './game-map-grid.component.html',
  styleUrl: './game-map-grid.component.scss',
})
export class GameMapGridComponent {
  @Input({ required: true }) cols!: number;
  @Input({ required: true }) rows!: number;
  @Input({ required: true }) cells: readonly GameCell[] = [];
  @Input() objects: readonly MapObject[] = [];
  @Input() players: readonly Player[] = [];
  @Input() nowMs = 0;
  @Input() actionModeEnabled = false;
  @Input() reachableCellKeys: ReadonlySet<string> = new Set<string>();
  @Input() reachableOriginKey: string | null = null;
  @Input() actionTargetCellKeys: ReadonlySet<string> = new Set<string>();
  @Input() inactiveSanctuaryObjectIds: ReadonlySet<number> = new Set<number>();
  @Output() cellClick = new EventEmitter<number>();
  @Output() cellContextMenu = new EventEmitter<{ event: MouseEvent; index: number }>();

  readonly tileType = TileType;
  readonly defaultPlayerState: CharacterState = PlayerPose.Idle;
  readonly deadPlayerState: CharacterState = PlayerPose.Dead;
  readonly defaultPlayerDirection: CharacterDirection = PlayerFacing.Front;

  onCellClick(index: number): void {
    this.cellClick.emit(index);
  }

  onCellContextMenu(event: MouseEvent, index: number): void {
    this.cellContextMenu.emit({ event, index });
  }

  isReachableCell(cell: GameCell): boolean {
    return this.reachableCellKeys.has(this.getCellKey(cell));
  }

  isReachableOrigin(cell: GameCell): boolean {
    return this.reachableOriginKey !== null && this.reachableOriginKey === this.getCellKey(cell);
  }

  isActionTarget(cell: GameCell): boolean {
    return this.actionTargetCellKeys.has(this.getCellKey(cell));
  }

  getPlayerAtCell(cell: GameCell): Player | null {
    return this.players.find((player) =>
      player.state.position?.x === cell.position.x && player.state.position?.y === cell.position.y) ?? null;
  }

  getObjectAtCell(cell: GameCell): MapObject | null {
    return this.objects.find((object) =>
      object.position.x === cell.position.x && object.position.y === cell.position.y) ?? null;
  }

  isUsedSanctuary(object: MapObject): boolean {
    return this.inactiveSanctuaryObjectIds.has(object.id);
  }

  getAvatarId(player: Player): number {
    return player.information.avatarId ?? 0;
  }

  isVirtualPlayer(player: Player): boolean {
    return player.information.controller === 'virtual';
  }

  getVirtualPlayerTitle(player: Player): string | null {
    if (!this.isVirtualPlayer(player)) {
      return null;
    }

    return player.information.virtualProfile === 'defensive' ? 'Joueur virtuel defensif' : 'Joueur virtuel agressif';
  }

  getVirtualPlayerProfile(player: Player): 'aggressive' | 'defensive' | null {
    if (!this.isVirtualPlayer(player)) {
      return null;
    }

    return player.information.virtualProfile === 'defensive' ? 'defensive' : 'aggressive';
  }

  getAvatarAriaLabel(player: Player): string {
    const playerType = this.isVirtualPlayer(player) ? 'joueur virtuel' : 'joueur';
    return `Avatar de ${player.information.name}, ${playerType}`;
  }

  getPlayerState(player: Player): CharacterState {
    if (player.state.status === PlayerStatus.Eliminated) return this.deadPlayerState;
    const pose = player.render?.pose ?? this.defaultPlayerState;
    if (this.isTransientPoseExpired(player, pose)) return this.defaultPlayerState;

    return pose;
  }

  getPlayerDirection(player: Player): CharacterDirection {
    return player.render?.facing ?? this.defaultPlayerDirection;
  }

  getBreathingDelay(playerId: string): string {
    const hash = Array.from(playerId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const delay = (hash % BREATHING_DELAY_VARIANTS) * BREATHING_DELAY_STEP_SECONDS;
    return `${delay}s`;
  }

  getTeamClass(teamId: string | null | undefined): string | null {
    return getTeamClass(teamId, 'player-layer--team-');
  }

  private isTransientPoseExpired(player: Player, pose: CharacterState): boolean {
    if (pose !== PlayerPose.Walk && pose !== PlayerPose.Attack) return false;
    if (!player.render?.poseStartedAt || !player.render?.poseDurationMs) return false;

    const startedAtMs = Date.parse(player.render?.poseStartedAt);
    if (Number.isNaN(startedAtMs)) return false;
    return this.nowMs >= startedAtMs + player.render?.poseDurationMs;
  }

  private getCellKey(cell: GameCell): string {
    return positionKey(cell.position);
  }
}
