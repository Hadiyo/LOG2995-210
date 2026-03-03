import { MapSize } from "./map.enums";
import { Vec2 } from "./map.interface";

export const getCellPositionAtIndex = (index: number, mapSize: MapSize): Vec2 => {
    return { x: index % mapSize, y: Math.floor(index / mapSize) };
}