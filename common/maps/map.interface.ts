import { PreviewImageFormat } from '../enum';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from './map.enums';

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
    position: Vec2;
    tileType: TileType;
    isWalkable: boolean;
    isOccupied: boolean;
}

export interface BaseMap {
    id: string;
    name: string;
    size: MapSize;
    mode: GameMode;
    objects: MapObject[];
}

export interface MapSummary {
    id: string;
    name: string;
    description: string;
    mode: GameMode;
    size: MapSize;
    date: string;
    visibility: boolean;
    previewImage?: string;
    previewImageFormat?: PreviewImageFormat;
}

export interface EditorMap extends BaseMap {
    description: string;
    date: string;
    map: EditorCell[];
    visibility: boolean;
    previewImage?: string;
    previewImageFormat?: PreviewImageFormat;
}

export interface EditorMapDetails {
    id: string;
    name: string;
    description: string;
    mode: GameMode;
    mapsize: MapSize;
    map: EditorCell[];
    objects: MapObject[];
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
