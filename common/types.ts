import { ObjectType, TileType } from "./maps/map.enums";
import { MouseEventType } from "./mouse-events.enum";

export type TileEvent = {
    type: MouseEventType;
    index: number;
    originalEvent: MouseEvent;
};

/**
 * Simple UI types for palette rendering
 * - Keeps template clean and strongly typed
 */
export type TilePaletteItem = { 
    id: TileType; 
    label: string; 
    description: string; 
    cssVar: string 
};

export type ObjectPaletteItem = { 
    id: ObjectType; 
    label: string; 
    description: string; 
    cssVar: string 
};