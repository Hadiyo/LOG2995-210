import { ObjectType, TileType } from '@common/maps/map.enums';

// Payload consumed by the tile info modal component.
export interface GameTileInfoModalData {
  positionLabel: string;
  tileType: TileType;
  isDoorOpen: boolean;
  tileLabel: string;
  tileCharacteristics: readonly string[];
  tileBlockingReason: string | null;
  objectType: ObjectType | null;
  objectLabel: string | null;
  objectDescription: string | null;
  playerName: string | null;
  playerAvatarId: number | null;
}
