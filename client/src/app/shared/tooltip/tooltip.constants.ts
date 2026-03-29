import { ObjectType, TileType } from '@common/maps/map.enums';
import { ObjectPaletteItem, TilePaletteItem } from '@common/types';

// Cursor offset for tooltips
export const CURSOR_OFFSET = 12;

/* =========================================================
     Tile palette configuration
     - Maps TileType enum to labels + theme color variables
     - Door uses a single enum value (TileType.DOOR):
       toggling open/closed handled by editor logic
     ========================================================= */
export const TILES: TilePaletteItem[] = [
    { id: TileType.WALL, label: 'Mur', description: 'Tuile non traversable.', cssVar: '--tile-wall-img' },
    {
        id: TileType.DOOR,
        label: 'Porte',
        description: 'Une porte doit se situer entre 2 murs. Elle peut etre ouverte ou fermee.',
        cssVar: '--tile-door-closed-img',
    },
    { id: TileType.WATER, label: 'Eau', description: 'Tuile traversable qui prend deux points de mouvement.', cssVar: '--tile-water-img' },
    { id: TileType.ICE, label: 'Glace', description: 'Tuile traversable qui prend aucun point de mouvement.', cssVar: '--tile-ice-img' },
];
    
/* =========================================================
    Object palette configuration
    - Maps ObjectType enum to labels + theme color variables
    ========================================================= */
export const OBJECTS: ObjectPaletteItem[] = [
    {
        id: ObjectType.START,
        label: 'Point de depart',
        description: "Un joueur est assigne aleatoirement un point de depart au debut d'une partie.",
        cssVar: '--object-spawn-img',
    },
    {   
        id: ObjectType.FLAG, 
        label: 'Drapeau', 
        description: "L'objectif principal du mode CTF.", 
        cssVar: '--object-flag-img' },
    {
        id: ObjectType.REGEN,
        label: 'Sanctuaire de soin',
        description: 'Activer pour regagner 2 points de vie au joueur.',
        cssVar: '--object-heal-img',
    },
    {
        id: ObjectType.ARENA,
        label: 'Sanctuaire de combat',
        description: "Activer pour un bonus temporaire de +1 à l'attaque et à la défense. Ce bonus reste jusqu'à la fin du prochain tour.",
        cssVar: '--object-fight-img',
    },
];
