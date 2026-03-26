import { Injectable } from '@angular/core';
import { GameMode, MapSize, ObjectType, TileType } from '@common/maps/map.enums';
import type { EditorMap, MapObject, Vec2 } from '@common/maps/map.interface';

import {
    FLAG_LIMIT,
    START_LIMITS_BY_SIZE,
} from './constants/editor.constants';

import { EditorMapFactoryService } from './editor-map-factory.service';
import { getCoveredPositions, positionsIntersect } from './utils/editor-geometry.util';


@Injectable({ providedIn: 'root' })
export class EditorPlacementRulesService {

    constructor(private readonly mapFactory: EditorMapFactoryService) {}

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
     */
    getObjectLimit(type: ObjectType, size: MapSize, mode: GameMode): number {
        if (type === ObjectType.FLAG) {
            return mode === GameMode.CTF ? FLAG_LIMIT : 0;
        }

        if (type === ObjectType.START) {
            return START_LIMITS_BY_SIZE[size];
        }

        return 0;
    }

    /**
     * Bounds check for any covered positions (prevents placing outside grid).
     */
    arePositionsInBounds(positions: Vec2[], size: MapSize): boolean {
        const { cols, rows } = this.mapFactory.getDimensions(size);
        return positions.every((position) => position.x >= 0 && position.y >= 0 && position.x < cols && position.y < rows);
    }

    /**
     * Placement validation:
     * - all covered tiles must exist and be walkable
     * - must not collide with existing objects
     */
    canPlaceObject(covered: Vec2[], objects: MapObject[], editorMap: EditorMap): boolean {
        // Map cell lookup by "x,y" for fast access
        const cellByKey = new Map(
            editorMap.map.map((cell, index) => [`${index % editorMap.size},${Math.floor(index / editorMap.size)}`, cell] as const),
        );

        // Check walkable
        for (const position of covered) {
            const cell = cellByKey.get(`${position.x},${position.y}`);
            if (!cell) return false;
            if (!cell.isWalkable) return false;
        }

        // Check collision with existing objects
        for (const object of objects) {
            const coveredByObject = getCoveredPositions(object.position, object.size);
            if (positionsIntersect(covered, coveredByObject)) return false;
        }

        return true;
    }
}
