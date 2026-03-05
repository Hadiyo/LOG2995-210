import { PreviewImageFormat } from "../enum";
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from "./map.enums";

export interface Vec2 {
    x: number;
    y: number;
}

export interface MapObject {
    id: number;
    type: ObjectType;
    position: Vec2;
    size: ObjectSize;
}

export interface EditorCell {
    tileType: TileType;
    isWalkable: boolean;
    isOccupied: boolean;
}

export interface BaseMap {
    id: string,
    name: string,
    size: MapSize,
    mode: GameMode,
    objects: MapObject[];
}

export interface EditorMap extends BaseMap {
    description: string;
    date: string;
    map: EditorCell[];
    visibility: boolean;
    previewImage?: string; // Optional base64-encoded preview image
    previewImageFormat?: PreviewImageFormat; // Optional format of the preview image
}

export interface GameCell extends EditorCell {
    position: Vec2;
}

export interface GameMap extends BaseMap {
    map: GameCell[];
}

export interface ObjectCountAndLimit {
    count: number;
    limit: number;
}

export interface MapDimensions {
    cols: number;
    rows: number;
}