import { Injectable } from '@angular/core';
import { GameMode, MapSize, ObjectType, TileType } from '@common/enum';
import type { EditorMap, MapObject, Vec2 } from '@common/interface';

import {
    FLAG_LIMIT,
    SANCTUARY_LIMITS_BY_SIZE,
    START_LIMITS_BY_SIZE,
} from './constants/editor.constants';

import { EditorMapFactoryService } from './editor-map-factory.service';
import { getCoveredPositions, positionsIntersect } from './utils/editor-geometry.util';


@Injectable({ providedIn: 'root' })
export class EditorPlacementRulesService {

    constructor(private mapFactory: EditorMapFactoryService) {}

    /**
     * Default walkability by tile type.
     * Door special case:
     * - default is closed when first placed (walkable=false)
     * - toggling happens in applyTileAtIndex()
     */
    isWalkable(tileType: TileType): boolean {
        switch (tileType) {
            case TileType.WALL:
                return false;
            case TileType.DOOR:
                return false; // default closed
            case TileType.WATER:
                return true;
            case TileType.ICE:
                return true;
            case TileType.DIRT:
            default:
                return true;
        }
    }

    /**
     * Object limits (editor-time validation)
     * - FLAG: only in CTF, singleton
     * - START: depends on map size
     * - REGEN/ARENA: depends on map size
     */
    getObjectLimit(type: ObjectType, size: MapSize, mode: GameMode): number {
        if (type === ObjectType.FLAG) {
            return mode === GameMode.CTF ? FLAG_LIMIT : 0;
        }

        if (type === ObjectType.START) {
            return START_LIMITS_BY_SIZE[size];
        }

        if (type === ObjectType.REGEN || type === ObjectType.ARENA) {
            return SANCTUARY_LIMITS_BY_SIZE[size];
        }

        return 0;
    }

    /**
     * Bounds check for any covered positions (prevents placing outside grid).
     */
    arePositionsInBounds(positions: Vec2[], size: MapSize): boolean {
        const { cols, rows } = this.mapFactory.getDimensions(size);
        return positions.every((p) => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows);
    }

    /**
     * Placement validation:
     * - all covered tiles must exist and be walkable
     * - must not collide with existing objects
     */
    canPlaceObject(covered: Vec2[], objects: MapObject[], m: EditorMap): boolean {
        // Map cell lookup by "x,y" for fast access
        const cellByKey = new Map(m.map.map((c, index) => [`${index % m.size},${Math.floor(index / m.size)}`, c] as const));

        // Check walkable
        for (const p of covered) {
            const cell = cellByKey.get(`${p.x},${p.y}`);
            if (!cell) return false;
            if (!cell.isWalkable) return false;
        }

        // Check collision with existing objects
        for (const o of objects) {
            const occ = getCoveredPositions(o.position, o.size);
            if (positionsIntersect(covered, occ)) return false;
        }

        return true;
    }
}