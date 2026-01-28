import { ObjectSize } from '@common/enum';
import type { Vec2 } from '@common/interface';

/**
 * Converts an anchor + size into all grid positions covered by the object.
 * - S => 1x1
 * - L => 2x2 (anchor is top-left)
 */
export function getCoveredPositions(anchor: Vec2, size: ObjectSize): Vec2[] {
    if (size === ObjectSize.L) {
        return [
            { x: anchor.x, y: anchor.y },
            { x: anchor.x + 1, y: anchor.y },
            { x: anchor.x, y: anchor.y + 1 },
            { x: anchor.x + 1, y: anchor.y + 1 },
        ];
    }
    return [{ x: anchor.x, y: anchor.y }];
}

/**
 * Checks if two position sets overlap.
 * Used for collision detection and overwrite behavior.
 */
export function positionsIntersect(a: Vec2[], b: Vec2[]): boolean {
    const bKey = new Set(b.map((p) => `${p.x},${p.y}`));
    return a.some((p) => bKey.has(`${p.x},${p.y}`));
}