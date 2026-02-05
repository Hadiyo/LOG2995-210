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
    tileType: TileType;
    isWalkable: boolean;
    isOccupied: boolean;
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
}

export interface ObjectCountAndLimit {
    count: number;
    limit: number
};

export interface MapDimensions {
    cols: number;
    rows: number;
}