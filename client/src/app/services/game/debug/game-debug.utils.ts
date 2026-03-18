import { GameSessionSnapshot } from '@common/game-session';
import { GameCell, Vec2 } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';

// Result payload used by the local runtime to finish teleport side effects like facing.
export interface DebugTeleportResult {
  previousPosition: Vec2;
  player: Player;
}

// Resolve the current player from a session snapshot and player id.
export function getCurrentDebugPlayer(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
): Player | null {
  if (!session || !currentPlayerId) return null;
  return session.players.find((player) => player.id === currentPlayerId) ?? null;
}

// Organizer-only guard used before toggling debug mode.
export function canToggleDebugMode(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
): boolean {
  return getCurrentDebugPlayer(session, currentPlayerId)?.information.isOrganizer ?? false;
}

// Apply the debug toggle directly on the mutable session snapshot.
export function toggleDebugModeInSession(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
): boolean {
  if (!session || !canToggleDebugMode(session, currentPlayerId)) return false;

  session.debugMode = !session.debugMode;
  return true;
}

// Disable debug mode when the organizer leaves the current game.
export function disableDebugModeIfOrganizerLeaves(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
): boolean {
  if (!session?.debugMode) return false;

  const currentPlayer = getCurrentDebugPlayer(session, currentPlayerId);
  if (!currentPlayer?.information.isOrganizer) return false;

  session.debugMode = false;
  return true;
}

// Allow the organizer to end the current active turn while debug mode is enabled.
export function canForceEndTurnInDebugMode(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
): boolean {
  if (!session?.debugMode) return false;

  const currentPlayer = getCurrentDebugPlayer(session, currentPlayerId);
  if (!currentPlayer?.information.isOrganizer) return false;

  return session.turn.activePlayerId !== '';
}

// Right click is reserved for teleportation only for the active organizer in debug mode.
export function canUseDebugTeleportRightClick(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
): boolean {
  if (!session?.debugMode || !currentPlayerId) return false;
  if (session.turn.activePlayerId !== currentPlayerId) return false;

  const currentPlayer = getCurrentDebugPlayer(session, currentPlayerId);
  if (!currentPlayer?.information.isOrganizer) return false;

  return currentPlayer.state.status === PlayerStatus.Active;
}

// A debug teleport target must be walkable and free of players and objects.
export function isFreeDebugTeleportCell(
  session: GameSessionSnapshot | null,
  targetCell: GameCell | undefined,
): targetCell is GameCell {
  if (!session || !targetCell || !targetCell.isWalkable || targetCell.isOccupied) return false;

  const occupiedByPlayer = session.players.some(
    (player) =>
      player.state.status === PlayerStatus.Active &&
      player.state.position?.x === targetCell.position.x &&
      player.state.position?.y === targetCell.position.y,
  );

  return !occupiedByPlayer;
}

// The active player may teleport only during their own turn while debug mode is enabled.
export function canTeleportInDebugMode(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
  targetCell: GameCell | undefined,
): boolean {
  if (!canUseDebugTeleportRightClick(session, currentPlayerId)) return false;

  return isFreeDebugTeleportCell(session, targetCell);
}

// Apply the debug teleport mutation directly on the mutable session snapshot.
export function applyDebugTeleportInSession(
  session: GameSessionSnapshot | null,
  currentPlayerId: string | null,
  targetCell: GameCell | undefined,
): DebugTeleportResult | null {
  if (!canTeleportInDebugMode(session, currentPlayerId, targetCell)) return null;
  if (!session || !currentPlayerId || !targetCell) return null;

  const currentPlayer = session.players.find((player) => player.id === currentPlayerId);
  if (!currentPlayer?.state.position) return null;

  const previousPosition = { ...currentPlayer.state.position };
  currentPlayer.state.position = { ...targetCell.position };
  return {
    previousPosition,
    player: currentPlayer,
  };
}
