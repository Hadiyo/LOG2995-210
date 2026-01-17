import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from './enum.ts';

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

export interface EditorMap {
    id: number;
    name: string;
    description: string;
    mode: GameMode;
    size: MapSize;
    date: string;
    map: EditorCell[];
    objects: MapObject[];
    visibility: boolean;
}

