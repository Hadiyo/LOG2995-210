import { CharacterDirection } from '@app/shared/character/character.types';
import { GameActionType } from '@common/game-socket-events';
import { TileType } from '@common/maps/map.enums';
import { GameCell } from '@common/maps/map.interface';
import { GamePlayerState, PlayerStatus } from '@common/player/player.interface';

// Inputs required to infer the intended action type for a clicked cell.
interface ResolveActionTypeParams {
  actionModeEnabled: boolean;
  cellIndex: number;
  mapCells: readonly GameCell[];
  players: readonly GamePlayerState[];
  currentPlayerId: string | null;
}

// Inputs required to validate whether an action is legal before sending to server.
interface ValidateActionParams {
  cellIndex: number;
  actionType: GameActionType;
  mapCells: readonly GameCell[];
  players: readonly GamePlayerState[];
  currentPlayer: GamePlayerState | null;
  adjacentTileDistance: number;
}

// Resolves action intent from UI state:
// - no action mode => MOVE
// - action mode + player on target => ATTACK
// - action mode + no player => INTERACT
export function resolveActionTypeForCell(params: ResolveActionTypeParams): GameActionType {
  const { actionModeEnabled, cellIndex, mapCells, players, currentPlayerId } = params;
  if (!actionModeEnabled) return 'MOVE';

  const targetCell = mapCells[cellIndex];
  if (!targetCell) return 'INTERACT';

  const hasTargetPlayer = players.some(
    (player) =>
      player.id !== currentPlayerId &&
      player.status === PlayerStatus.Active &&
      player.position?.x === targetCell.position.x &&
      player.position?.y === targetCell.position.y,
  );

  return hasTargetPlayer ? 'ATTACK' : 'INTERACT';
}

// Fast client-side pre-validation to avoid obviously invalid socket commands.
// Server remains source of truth for final validation.
export function isLikelyValidAction(params: ValidateActionParams): boolean {
  const { cellIndex, actionType, mapCells, players, currentPlayer, adjacentTileDistance } = params;
  const targetCell = mapCells[cellIndex];
  if (!currentPlayer?.position || !targetCell) return false;

  const distance = getManhattanDistance(
    currentPlayer.position.x,
    currentPlayer.position.y,
    targetCell.position.x,
    targetCell.position.y,
  );
  if (distance !== adjacentTileDistance) return false;

  // MOVE rules: movement points, walkable tile, and unoccupied target.
  if (actionType === 'MOVE') {
    if (currentPlayer.remainingMovement <= 0) return false;
    if (!targetCell.isWalkable) return false;

    const isOccupied = players.some(
      (player) =>
        player.id !== currentPlayer.id &&
        player.status === PlayerStatus.Active &&
        player.position?.x === targetCell.position.x &&
        player.position?.y === targetCell.position.y,
    );
    return !isOccupied;
  }

  // ATTACK rules: action points and an active enemy target on clicked cell.
  if (actionType === 'ATTACK') {
    if (currentPlayer.remainingActions <= 0) return false;

    return players.some(
      (player) =>
        player.id !== currentPlayer.id &&
        player.status === PlayerStatus.Active &&
        player.position?.x === targetCell.position.x &&
        player.position?.y === targetCell.position.y,
    );
  }

  // INTERACT rules: action points and currently door-only interaction target.
  if (currentPlayer.remainingActions <= 0) return false;
  return targetCell.tileType === TileType.DOOR;
}

// Manhattan metric (grid distance): |dx| + |dy|.
export function getManhattanDistance(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.abs(toX - fromX) + Math.abs(toY - fromY);
}

// Converts source->target vector to one of 4 cardinal sprite directions.
// Horizontal axis is prioritized when |dx| == |dy|.
export function getDirectionToTarget(fromX: number, fromY: number, toX: number, toY: number): CharacterDirection | null {
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  if (deltaX === 0 && deltaY === 0) return null;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'front' : 'back';
}
