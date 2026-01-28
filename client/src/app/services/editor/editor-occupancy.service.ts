import { Injectable } from '@angular/core';
import type { EditorCell, MapObject, Vec2 } from '@common/interface';
import { getCoveredPositions } from './utils/editor-geometry.util';

/**
 * Service to determine cell occupancy in the editor map.
 * - Used to check for collisions and valid placements.
 */
@Injectable({ providedIn: 'root' })
export class EditorOccupancyService {

    /**
     * Recompute each cell's isOccupied flag based on current objects.
     * This is derived data, but stored for convenience (UI + rules).
     */
    refreshOccupied(cells: EditorCell[], objects: MapObject[]): EditorCell[] {
        const occupiedKey = new Set<string>();

        // Mark all covered tiles of all objects as occupied
        for (const o of objects) {
            for (const p of getCoveredPositions(o.position, o.size)) {
                occupiedKey.add(`${p.x},${p.y}`);
            }
        }

        // Copy cells and update isOccupied
        return cells.map((c) => ({
            ...c,
            isOccupied: occupiedKey.has(`${c.position.x},${c.position.y}`),
        }));
    }

    /**
     * Returns the object covering a given position.
     * Supports 2x2 objects by checking their covered area.
     */
    findObjectCoveringPosition(objects: MapObject[], pos: Vec2): MapObject | null {
        for (const o of objects) {
            const covered = getCoveredPositions(o.position, o.size);
            if (covered.some((p) => p.x === pos.x && p.y === pos.y)) return o;
        }
        return null;
    }

    // Filter out object to remove
    removeObjectByPosition(objects: MapObject[], position: Vec2): MapObject[] {
        return objects.filter((o) => {
            const covered = getCoveredPositions(o.position, o.size);
            return !covered.some((p) => p.x === position.x && p.y === position.y);
        });
    }

}