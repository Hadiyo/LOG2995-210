import { Injectable } from '@angular/core';
import { GameMode, MapSize, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapDimensions } from '@common/interface';
import { MAP_DIMENSIONS_BY_SIZE } from './constants/editor.constants';

@Injectable({ providedIn: 'root' })
export class EditorMapFactoryService {

    /* =========================================================
       Map creation & rule helpers
       ========================================================= */

    /**
     * MapSize -> numeric dimensions.
     */
    getDimensions(size: MapSize): MapDimensions {
        return MAP_DIMENSIONS_BY_SIZE[size] ?? MAP_DIMENSIONS_BY_SIZE[MapSize.S];
    }

    /**
     * Creates a fresh empty editor map.
     * - Used on initialization, resize, and reset.
     */
    createEmptyMap(opts?: {
        size?: MapSize;
        mode?: GameMode;
        name?: string;
        description?: string;
    }): EditorMap {
        const size = opts?.size ?? MapSize.S;
        const mode = opts?.mode ?? GameMode.CLASSIC;
        const name = opts?.name ?? '';
        const description = opts?.description ?? '';

        const { cols, rows } = this.getDimensions(size);

        // Generate base grid (default: walkable dirt)
        const cells: EditorCell[] = [];
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                cells.push({
                    position: { x, y },
                    tileType: TileType.DIRT,
                    isWalkable: true,
                    isOccupied: false,
                });
            }
        }

        const now = new Date().toISOString();

        return {
            id: '',
            name,
            description,
            mode,
            size,
            date: now,
            map: cells,
            objects: [],
            visibility: false,
        };
    }

    /**
     * Deep clone an editor map to avoid mutating persisted state.
     */
    cloneEditorMap(game: EditorMap): EditorMap {
        return {
            ...game,
            map: game.map.map((cell) => ({
                ...cell,
                position: { ...cell.position },
            })),
            objects: game.objects.map((object) => ({
                ...object,
                position: { ...object.position },
            })),
        };
    }

}
