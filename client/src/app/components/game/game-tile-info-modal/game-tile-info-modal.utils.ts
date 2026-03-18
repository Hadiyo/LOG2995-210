import {
  OBJECT_DESCRIPTIONS,
  OBJECT_LABELS,
  TILE_DESCRIPTIONS,
  TILE_LABELS,
} from '@app/components/game/game-tile-info-modal/game-tile-info-modal.constants';
import { GameTileInfoModalData } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.interface';
import { ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { GameCell, MapObject, Vec2 } from '@common/maps/map.interface';
import { Player } from '@common/player/player.interface';

// Build the tile info payload shown in the modal after a right click.
export function buildTileInfoModalData(
  cell: GameCell,
  objects: readonly MapObject[],
  players: readonly Player[],
): GameTileInfoModalData {
  const object = getObjectAtCell(cell.position, objects);
  const player = getPlayerAtCell(cell.position, players);
  const tileBlockingReason = getTileBlockingReason(object, player);
  const tileCharacteristics = buildTileCharacteristics(cell, tileBlockingReason !== null);

  return {
    positionLabel: `Tuile (${cell.position.x}, ${cell.position.y})`,
    tileType: cell.tileType,
    isDoorOpen: cell.tileType === TileType.DOOR && cell.isWalkable,
    tileLabel: TILE_LABELS[cell.tileType],
    tileCharacteristics,
    tileBlockingReason,
    objectType: object?.type ?? null,
    objectLabel: object ? OBJECT_LABELS[object.type] : null,
    objectDescription: object ? OBJECT_DESCRIPTIONS[object.type] : null,
    playerName: player?.information.name ?? null,
    playerAvatarId: player?.information.avatarId ?? null,
  };
}

// Build the list of tile characteristics shown in the modal body, including walkability and door state.
function buildTileCharacteristics(cell: GameCell, isBlockedByOccupant: boolean): string[] {
  const tileCharacteristics = [
    TILE_DESCRIPTIONS[cell.tileType],
    !isBlockedByOccupant && cell.isWalkable ? 'Tuile traversable.' : 'Tuile non traversable.',
  ];

  const doorState = getDoorStateDescription(cell);
  if (doorState) {
    tileCharacteristics.push(doorState);
  }

  return tileCharacteristics;
}

// A tile is considered blocked if it is occupied by a player or a blocking object like a sanctuary.
function getTileBlockingReason(object: MapObject | null, player: Player | null): string | null {
  if (player) {
    return 'Un joueur occupe actuellement cette tuile.';
  }

  if (object?.type === ObjectType.REGEN || object?.type === ObjectType.ARENA) {
    return 'Un sanctuaire occupe cette tuile.';
  }

  return null;
}

// Describe the current door state only for door tiles.
function getDoorStateDescription(cell: GameCell): string | null {
  if (cell.tileType !== TileType.DOOR) return null;
  return cell.isWalkable ? "La porte est ouverte. Cout d'un point de mouvement." : 'La porte est fermee.';
}

// Resolve the object covering a cell.
function getObjectAtCell(position: Vec2, objects: readonly MapObject[]): MapObject | null {
  return objects.find((object) => doesObjectCoverPosition(object, position)) ?? null;
}

// Resolve the player standing on a specific cell.
function getPlayerAtCell(position: Vec2, players: readonly Player[]): Player | null {
  return players.find(
    (player) => player.state.position?.x === position.x && player.state.position?.y === position.y,
  ) ?? null;
}

// Check whether an object covers a cell, including large 2x2 objects.
function doesObjectCoverPosition(object: MapObject, position: Vec2): boolean {
  const width = object.size === ObjectSize.L ? 2 : 1;
  const height = object.size === ObjectSize.L ? 2 : 1;

  return (
    position.x >= object.position.x &&
    position.x < object.position.x + width &&
    position.y >= object.position.y &&
    position.y < object.position.y + height
  );
}
