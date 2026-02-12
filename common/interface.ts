import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from './enum';

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

// Possible formats for preview images
export enum PreviewImageFormat {
    WEBP = 'webp',
    PNG = 'png',
}

export interface EditorMap {
    id: string;
    name: string;
    description: string;
    mode: GameMode;
    size: MapSize;
    date: string;
    map: EditorCell[];
    objects: MapObject[];
    visibility: boolean;
    // Optional base64-encoded preview image
    previewImage?: string;
    // Optional format of the preview image
    previewImageFormat?: PreviewImageFormat;
}

export interface ObjectCountAndLimit {
    count: number;
    limit: number;
}

export interface MapDimensions {
    cols: number;
    rows: number;
}
