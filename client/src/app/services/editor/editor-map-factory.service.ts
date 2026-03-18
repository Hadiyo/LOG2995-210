import { Injectable } from '@angular/core';
import { GameMode, MapSize, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMap } from '@common/maps/map.interface';

@Injectable({ providedIn: 'root' })
export class EditorMapFactoryService {

    /* =========================================================
       Map creation & rule helpers
       ========================================================= */

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

        const cols = size;
        const rows = size;

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
            })),
            objects: game.objects.map((object) => ({
                ...object,
            })),
        };
    }

}
