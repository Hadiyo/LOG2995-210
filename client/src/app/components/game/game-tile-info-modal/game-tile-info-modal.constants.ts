import { ObjectType, TileType } from '@common/maps/map.enums';

// Label of each tile type shown in the modal header.
export const TILE_LABELS: Record<TileType, string> = {
  [TileType.DIRT]: 'Terrain',
  [TileType.WATER]: 'Eau',
  [TileType.ICE]: 'Glace',
  [TileType.WALL]: 'Mur',
  [TileType.DOOR]: 'Porte',
};

// Descriptions of each tile type shown in the modal body.
export const TILE_DESCRIPTIONS: Record<TileType, string> = {
  [TileType.DIRT]: 'Cout un point de mouvement.',
  [TileType.WATER]: 'Cout deux points de mouvement.',
  [TileType.ICE]: 'Aucun cout de mouvement.',
  [TileType.WALL]: 'Mur infranchissable.',
  [TileType.DOOR]: 'Element interactif pouvant etre ouvert ou ferme.',
};

// Label of each object type shown in the modal header.
export const OBJECT_LABELS: Partial<Record<ObjectType, string>> = {
  [ObjectType.START]: 'Point de depart',
};

// Descriptions of each object type shown in the modal body.
export const OBJECT_DESCRIPTIONS: Partial<Record<ObjectType, string>> = {
  [ObjectType.START]: "Un joueur est assigne aleatoirement a ce point au debut d'une partie.",
};
