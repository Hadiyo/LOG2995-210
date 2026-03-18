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
  [TileType.DIRT]: 'Coût un point de mouvement.',
  [TileType.WATER]: 'Coût deux points de mouvement.',
  [TileType.ICE]: 'Aucun coût de mouvement.',
  [TileType.WALL]: 'Mur infranchissable.',
  [TileType.DOOR]: 'Élément interactif pouvant être ouvert ou fermé.',
};

// Label of each object type shown in the modal header.
export const OBJECT_LABELS: Record<ObjectType, string> = {
  [ObjectType.START]: 'Point de départ',
  [ObjectType.FLAG]: 'Drapeau',
  [ObjectType.REGEN]: 'Sanctuaire de soin',
  [ObjectType.ARENA]: 'Sanctuaire de combat',
};

// Descriptions of each object type shown in the modal body.
export const OBJECT_DESCRIPTIONS: Record<ObjectType, string> = {
  [ObjectType.START]: "Un joueur est assigné aléatoirement à ce point au début d'une partie.",
  [ObjectType.FLAG]: "L'objectif principal du mode CTF. Pour gagner, un joueur doit revenir sur son point de départ avec le drapeau.",
  [ObjectType.REGEN]: 'Activer pour regagner 2 points de vie au joueur sans dépasser le maximum.',
  [ObjectType.ARENA]: 'Activer pour obtenir un bonus temporaire de +1 en attaque et +1 en défense.',
};
