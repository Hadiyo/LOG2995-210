import { ObjectType, TileType } from '@common/maps/map.enums';

export interface TilePaletteItem {
    id: TileType;
    label: string;
    description: string;
    cssVar: string;
}

export interface ObjectPaletteItem {
    id: ObjectType;
    label: string;
    description: string;
    cssVar: string;
}
