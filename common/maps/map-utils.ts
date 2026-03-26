import { MapSize, ObjectSize } from "./map.enums";
import { Vec2 } from "./map.interface";

export const getCellPositionAtIndex = (index: number, mapSize: MapSize): Vec2 => {
    return { x: index % mapSize, y: Math.floor(index / mapSize) };
}

export const getIndexFromPosition = (position: Vec2, mapSize: MapSize): number => {
    return position.y * mapSize + position.x;
}

/**
 * Converts an anchor + size into all grid positions covered by the object.
 * - S => 1x1
 * - L => 2x2 (anchor is top-left)
 */
export const getCoveredPositions = (position: Vec2, size: ObjectSize): Vec2[] => {
    if (size === ObjectSize.S) {
        return [{ ...position }];
    }

    return [
        { ...position },
        { x: position.x + 1, y: position.y },
        { x: position.x, y: position.y + 1 },
        { x: position.x + 1, y: position.y + 1 },
    ];
}