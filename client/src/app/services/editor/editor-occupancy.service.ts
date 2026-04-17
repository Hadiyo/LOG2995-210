import { Injectable } from '@angular/core';
import { getCellPositionAtIndex, getCoveredPositions } from '@common/maps/map-utils';
import { MapSize } from '@common/maps/map.enums';
import { EditorCell, MapObject, Vec2 } from '@common/maps/map.interface';

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
    refreshOccupied(cells: EditorCell[], objects: MapObject[], mapSize: MapSize): EditorCell[] {
        const occupiedKey = new Set<string>();

        // Mark all covered tiles of all objects as occupied
        for (const object of objects) {
            for (const position of getCoveredPositions(object.position, object.size)) {
                occupiedKey.add(`${position.x},${position.y}`);
            }
        }

        // Copy cells and update isOccupied
        return cells.map((c, index) => {
            const pos = getCellPositionAtIndex(index, mapSize);
            return {
                ...c,
                isOccupied: occupiedKey.has(`${pos.x},${pos.y}`),
            };
        });
    }

    /**
     * Returns the object covering a given position.
     * Supports 2x2 objects by checking their covered area.
     */
    findObjectCoveringPosition(objects: MapObject[], pos: Vec2): MapObject | null {
        for (const object of objects) {
            const covered = getCoveredPositions(object.position, object.size);
            if (covered.some((position) => position.x === pos.x && position.y === pos.y)) {
                return object;
            }
        }
        return null;
    }

    // Filter out object to remove
    removeObjectByPosition(objects: MapObject[], pos: Vec2): MapObject[] {
        return objects.filter((object) => {
            const covered = getCoveredPositions(object.position, object.size);
            return !covered.some((position) => position.x === pos.x && position.y === pos.y);
        });
    }
}
