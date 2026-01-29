import { Injectable, computed, signal } from '@angular/core';
import { GameMode, MapSize, MouseButton, ObjectSize, ObjectType, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapObject } from '@common/interface';

// Types
import type { SelectedCellInfo } from './types/selected-cell-info.type';

// Geometry utils
import { getCoveredPositions } from './utils/editor-geometry.util';

// Services
import { EditorMapFactoryService } from './editor-map-factory.service';
import { EditorOccupancyService } from './editor-occupancy.service';
import { EditorPlacementRulesService } from './editor-placement-rules.service';

@Injectable({ providedIn: 'root' })
export class EditorStateService {
    constructor(
        private occupancy: EditorOccupancyService,
        private mapFactory: EditorMapFactoryService,
        private rules: EditorPlacementRulesService,
    ) {}

    /* =========================================================
       Editor UI selection state (signals)
       ========================================================= */

    // Boolean for if Shift is pressed
    readonly isShiftPressed = signal<boolean>(false);

    // Used to track mouse button state globally
    readonly activeButton = signal<MouseButton | null>(null);

    /**
     * We select WHAT we want to apply:
     * - either a tile type OR an object type
     * - never both at the same time (keeps UX simple and predictable)
     */
    readonly selectedTileType = signal<TileType | null>(null);
    readonly selectedObjectType = signal<ObjectType | null>(null);

    // Current inspected cell info (used when tool = 'mouse')
    readonly selectedCell = signal<SelectedCellInfo | null>(null);

    /* =========================================================
       Editor map state (single source of truth)
       ========================================================= */

    // The current map being edited (cells + objects + metadata)
    readonly editorMap = signal<EditorMap>(this.mapFactory.createEmptyMap());

    // Derived dimensions based on chosen map size
    readonly dimensions = computed(() => this.mapFactory.getDimensions(this.editorMap().size));
    readonly cols = computed(() => this.dimensions().cols);
    readonly rows = computed(() => this.dimensions().rows);

    // Convenience computed signals for template usage
    readonly cells = computed(() => this.editorMap().map);
    readonly objects = computed(() => this.editorMap().objects);

    /* =========================================================
       Public API — palette selection
       ========================================================= */

    /**
     * Select a tile to paint:
     * - clears object selection
     * - switches tool to applicator for immediate placement
     */
    selectTile(tileType: TileType): void {
        this.selectedTileType.set(tileType);
        this.selectedObjectType.set(null);
        // this.selectedTool.set('applicator');
    }

    /**
     * Select an object to place:
     * - enforces CTF rule for FLAG
     * - clears tile selection
     * - switches tool to applicator
     */
    selectObject(objectType: ObjectType): void {
        // Flag is only available when map mode is CTF
        if (objectType === ObjectType.FLAG && this.editorMap().mode !== GameMode.CTF) return;

        this.selectedObjectType.set(objectType);
        this.selectedTileType.set(null);
    }

    /**
     * Clear current painting selection and return to inspect mode.
     * This is a "cancel selection", not "undo map changes".
     */
    clearSelection(): void {
        this.selectedTileType.set(null);
        this.selectedObjectType.set(null);
    }

    /* =========================================================
       Public API — map metadata
       ========================================================= */

    setName(name: string): void {
        this.editorMap.update((m) => ({ ...m, name }));
    }

    setDescription(description: string): void {
        this.editorMap.update((m) => ({ ...m, description }));
    }

    /**
     * Change game mode.
     */
    setMode(mode: GameMode): void {
        this.editorMap.update((m) => ({ ...m, mode }));

        // If we switch away from CTF:
        // - unselect FLAG if it was selected
        // - remove placed flag from map
        // - recompute occupancy
        if (mode !== GameMode.CTF) {
            this.selectedObjectType.update((t) => (t === ObjectType.FLAG ? null : t));
            this.editorMap.update((m) => ({
                ...m,
                objects: m.objects.filter((o) => o.type !== ObjectType.FLAG),
            }));
            this.editorMap.update((m) => ({
                ...m,
                map: this.occupancy.refreshOccupied(m.map, m.objects),
            }));
        }
    }

    /**
     * Change map size:
     * - rebuilds a fresh empty map with same mode/name/description
     * - clears UI selection
     *
     * (Note: currently does NOT attempt to migrate existing content.)
     */
    setSize(size: MapSize): void {
        const current = this.editorMap();
        this.editorMap.set(
            this.mapFactory.createEmptyMap({
                size,
                mode: current.mode,
                name: current.name,
                description: current.description,
            }),
        );
        this.clearSelection();
    }

    /**
     * Reset map content (cells + objects) but keep size/mode/name/description.
     */
    resetMap(): void {
        const current = this.editorMap();
        this.editorMap.set(
            this.mapFactory.createEmptyMap({
                size: current.size,
                mode: current.mode,
                name: current.name,
                description: current.description,
            }),
        );
        this.clearSelection();
    }

    /* =========================================================
       Public API — called by Sidebar
       ========================================================= */

    /** 
    * Get count of object of a given type and its limit
    */
    getObjectCountAndLimit(type: ObjectType): { count: number; limit: number } {
        const m = this.editorMap();
        const count = m.objects.filter((o) => o.type === type).length;
        const limit = this.rules.getObjectLimit(type, m.size, m.mode);
        return { count, limit };
    }

    /* =========================================================
       Public API — called by Canvas
       ========================================================= */

    /**
     * Applicator tool entry point:
     * Applies either a tile or an object at the given index
     */
    applyAtIndex(index: number): void {
        const tileType = this.selectedTileType();
        const objectType = this.selectedObjectType();
        if (!tileType && !objectType) return;

        // Only one should be active, but we keep both checks safe
        if (tileType) this.applyTileAtIndex(index, tileType);
        if (objectType) this.placeObjectAtIndex(index, objectType);
    }

    /**
     * Used by template to render the object overlay on a cell.
     * Returns the object that covers the cell position (supports 2x2).
     */
    getObjectAtIndex(index: number): MapObject | null {
        const map = this.editorMap();
        const cell = map.map[index];
        if (!cell) return null;

        return this.occupancy.findObjectCoveringPosition(map.objects, cell.position);
    }

    /**
     * Eraser behavior:
     * - Removes any object whose covered area includes this cell
     * (This makes erasing intuitive for 2x2 objects as well.)
     */
    eraseObjectAtIndex(index: number): void {
        this.editorMap.update((m) => {
            const cell = m.map[index];
            if (!cell) return m;

            // Keep only objects that DO NOT cover the clicked cell
            const remaining = this.occupancy.removeObjectByPosition(
                m.objects,
                cell.position,
            );

            return {
                ...m,
                objects: remaining,
                map: this.occupancy.refreshOccupied(m.map, remaining),
            };
        });
    }

    /**
     * Eraser behavior:
     * - Removes tiles by resetting to default DIRT
     */
    eraseTileAtIndex(index: number): void {
        this.applyTileAtIndex(index, TileType.DIRT);
    }

    /* =========================================================
       Internal helpers — apply tile/object
       ========================================================= */

    /**
     * Writes tile type + walkability into the target cell.
     * Door rule:
     * - Door uses a single TileType.DOOR
     * - Door "open/closed" is encoded in isWalkable (toggle on repeat apply)
     */
    private applyTileAtIndex(index: number, tileType: TileType): void {
        this.editorMap.update((m) => {
            const cell = m.map[index];
            if (!cell) return m;

            let nextTileType = tileType;
            let nextWalkable = this.rules.isWalkable(tileType);

            // Door toggling logic
            if (tileType === TileType.DOOR) {
                nextTileType = TileType.DOOR;

                // If already a door, flip open/closed
                if (cell.tileType === TileType.DOOR) {
                    nextWalkable = !cell.isWalkable;
                } else {
                    // First time placing door: default closed
                    nextWalkable = false;
                }
            }

            let existingObjects = m.objects;

            if (!nextWalkable) {
                existingObjects = this.occupancy.removeObjectByPosition(m.objects, cell.position);
            }

            const updated: EditorCell = {
                ...cell,
                tileType: nextTileType,
                isWalkable: nextWalkable,
            };

            // Immutable update to keep signals predictable
            const newMap = m.map.slice();
            newMap[index] = updated;

            const next = { ...m, map: newMap, objects: existingObjects };
            return { ...next, map: this.occupancy.refreshOccupied(next.map, next.objects) };
        });
    }

    /**
     * Place an object anchored at the clicked cell.
     * Rules enforced here:
     * - must be on walkable tiles
     * - must fit within bounds (2x2 supported)
     * - must not collide with other objects
     * - must respect type limits (start/sanctuary/flag)
     * - placing overwrites intersecting objects (by design)
     */
    private placeObjectAtIndex(index: number, type: ObjectType): void {
        // Hard rule: flag only in CTF
        if (type === ObjectType.FLAG && this.editorMap().mode !== GameMode.CTF) return;

        this.editorMap.update((m) => {
            const cell = m.map[index];
            if (!cell) return m;

            // Objects only on walkable tiles
            if (!cell.isWalkable) return m;

            const anchor = cell.position;

            // Size rule: sanctuaries are 2x2, others are 1x1
            const size: ObjectSize =
                type === ObjectType.REGEN || type === ObjectType.ARENA ? ObjectSize.L : ObjectSize.S;

            // Enforce per-type limits based on map size + mode
            const limit = this.rules.getObjectLimit(type, m.size, m.mode);
            if (limit === 0) return m;

            const existingOfType = m.objects.filter((o) => o.type === type);
            if (existingOfType.length >= limit) return m;

            // Current object list (kept as-is unless overwritten by intersection)
            const objectsFiltered = m.objects;

            // Covered positions for this placement (1x1 or 2x2)
            const covered = getCoveredPositions(anchor, size);

            // Must fit inside the map
            if (!this.rules.arePositionsInBounds(covered, m.size)) return m;

            // Must be walkable everywhere + no collisions
            if (!this.rules.canPlaceObject(covered, objectsFiltered, m)) return m;

            // Collision policy: placement is rejected if it intersects an existing object.
            const newObj: MapObject = {
                id: this.nextObjectId(objectsFiltered),
                type,
                position: { ...anchor },
                size,
            };

            const nextObjects = [...objectsFiltered, newObj];
            return { ...m, objects: nextObjects, map: this.occupancy.refreshOccupied(m.map, nextObjects) };
        });
    }

    /* =========================================================
       Occupancy + object lookup
       ========================================================= */

    /**
     * Generates a new incremental object id.
     */
    private nextObjectId(objects: MapObject[]): number {
        let max = 0;
        for (const o of objects) max = Math.max(max, o.id);
        return max + 1;
    }
}
