import { MapSize } from './enum';
import { Vec2 } from './interface';

export const getCellPositionAtIndex = (index: number, mapSize: MapSize): Vec2 => {
    return { x: index % mapSize, y: Math.floor(index / mapSize) };
}