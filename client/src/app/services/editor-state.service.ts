import { Injectable, computed, inject, signal } from '@angular/core';
import { EditorApiService } from '@app/services/editor-api.service';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapObject, Vec2 } from '@common/interface';

/* =========================================================
   Placement limits by map size
   - Enforces game rules at editor-time (prevents invalid maps)
   ========================================================= */
const START_LIMITS_BY_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 2,
    [MapSize.M]: 4,
    [MapSize.L]: 6,
};

const SANCTUARY_LIMITS_BY_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 1,
    [MapSize.M]: 2,
    [MapSize.L]: 4,
};

const FLAG_LIMIT = 1;

/**
 * Snapshot of what the user is currently inspecting (mouse tool)
 * Stored so Sidebar / UI can show contextual actions like "delete object".
 */
export type SelectedCellInfo = {
    index: number;
    position: Vec2;
    tileType: TileType;
    objectType: ObjectType | null;
    objectId: number | null;
};

@Injectable({ providedIn: 'root' })
export class EditorStateService {
    /* =========================================================
       Editor UI selection state (signals)
       ========================================================= */

    // Which editor tool is currently active
    // readonly selectedTool = signal<EditorToolId>('mouse');

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
    readonly editorMap = signal<EditorMap>(this.createEmptyMap());

    // Derived dimensions based on chosen map size
    readonly dimensions = computed(() => this.getDimensions(this.editorMap().size));
    readonly cols = computed(() => this.dimensions().cols);
    readonly rows = computed(() => this.dimensions().rows);

    // Convenience computed signals for template usage
    readonly cells = computed(() => this.editorMap().map);
    readonly objects = computed(() => this.editorMap().objects);

    /* =========================================================
       Public API — palette selection
       ========================================================= */
    private editorApi = inject(EditorApiService);

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
        // this.selectedTool.set('applicator');
    }

    /**
     * Clear current painting selection and return to inspect mode.
     * This is a "cancel selection", not "undo map changes".
     */
    clearSelection(): void {
        this.selectedTileType.set(null);
        this.selectedObjectType.set(null);
        // this.selectedTool.set('mouse');
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
            this.refreshOccupied();
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
            this.createEmptyMap({
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
            this.createEmptyMap({
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
        const limit = this.getObjectLimit(type, m.size, m.mode);
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

        return this.findObjectCoveringPosition(cell.position);
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

            const pos = cell.position;

            // Keep only objects that DO NOT cover the clicked cell
            const remaining = this.removeObjectByPosition(pos);

            return { ...m, objects: remaining };
        });

        this.refreshOccupied();
    }

    /**
     * Eraser behavior:
     * - Removes tiles by resetting to default DIRT
     */
    eraseTileAtIndex(index: number): void {
        this.applyTileAtIndex(index, TileType.DIRT);

        this.refreshOccupied();
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
            let nextWalkable = this.isWalkable(tileType);

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
                existingObjects = this.removeObjectByPosition(cell.position);
            }

            const updated: EditorCell = {
                ...cell,
                tileType: nextTileType,
                isWalkable: nextWalkable,
            };

            // Immutable update to keep signals predictable
            const newMap = m.map.slice();
            newMap[index] = updated;

            return { ...m, map: newMap, objects: existingObjects };
        });

        // Occupancy might change if tile became non-walkable under an object, etc.
        this.refreshOccupied();
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
            const limit = this.getObjectLimit(type, m.size, m.mode);
            if (limit === 0) return m;

            const existingOfType = m.objects.filter((o) => o.type === type);
            if (existingOfType.length >= limit) return m;

            // Current object list (kept as-is unless overwritten by intersection)
            const objectsFiltered = m.objects;

            // Covered positions for this placement (1x1 or 2x2)
            const covered = this.getCoveredPositions(anchor, size);

            // Must fit inside the map
            if (!this.arePositionsInBounds(covered, m.size)) return m;

            // Must be walkable everywhere + no collisions
            if (!this.canPlaceObject(covered, objectsFiltered, m)) return m;

            /**
             * Overwrite policy:
             * If a new placement intersects an existing object, we remove the old one.
             */
            const objectsWithoutIntersect = objectsFiltered.filter(
                (o) => !this.positionsIntersect(covered, this.getCoveredPositions(o.position, o.size)),
            );

            const newObj: MapObject = {
                id: this.nextObjectId(objectsWithoutIntersect),
                type,
                position: { ...anchor },
                size,
            };

            return { ...m, objects: [...objectsWithoutIntersect, newObj] };
        });

        this.refreshOccupied();
    }

    /* =========================================================
       Occupancy + object lookup
       ========================================================= */

    /**
     * Recompute each cell's isOccupied flag based on current objects.
     * This is derived data, but stored for convenience (UI + rules).
     */
    private refreshOccupied(): void {
        this.editorMap.update((m) => {
            const occupiedKey = new Set<string>();

            // Mark all covered tiles of all objects as occupied
            for (const o of m.objects) {
                for (const p of this.getCoveredPositions(o.position, o.size)) {
                    occupiedKey.add(`${p.x},${p.y}`);
                }
            }

            // Copy cells and update isOccupied
            const newCells = m.map.map((c) => ({
                ...c,
                isOccupied: occupiedKey.has(`${c.position.x},${c.position.y}`),
            }));

            return { ...m, map: newCells };
        });
    }

    /**
     * Returns the object covering a given position.
     * Supports 2x2 objects by checking their covered area.
     */
    private findObjectCoveringPosition(pos: Vec2): MapObject | null {
        const m = this.editorMap();
        for (const o of m.objects) {
            const covered = this.getCoveredPositions(o.position, o.size);
            if (covered.some((p) => p.x === pos.x && p.y === pos.y)) return o;
        }
        return null;
    }

    /**
     * Generates a new incremental object id.
     */
    private nextObjectId(objects: MapObject[]): number {
        let max = 0;
        for (const o of objects) max = Math.max(max, o.id);
        return max + 1;
    }

    /**
     * Converts an anchor + size into all grid positions covered by the object.
     * - S => 1x1
     * - L => 2x2 (anchor is top-left)
     */
    private getCoveredPositions(anchor: Vec2, size: ObjectSize): Vec2[] {
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
    private positionsIntersect(a: Vec2[], b: Vec2[]): boolean {
        const bKey = new Set(b.map((p) => `${p.x},${p.y}`));
        return a.some((p) => bKey.has(`${p.x},${p.y}`));
    }

    /**
     * Bounds check for any covered positions (prevents placing outside grid).
     */
    private arePositionsInBounds(positions: Vec2[], size: MapSize): boolean {
        const { cols, rows } = this.getDimensions(size);
        return positions.every((p) => p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows);
    }

    /**
     * Placement validation:
     * - all covered tiles must exist and be walkable
     * - must not collide with existing objects
     */
    private canPlaceObject(covered: Vec2[], objects: MapObject[], m: EditorMap): boolean {
        // Map cell lookup by "x,y" for fast access
        const cellByKey = new Map(m.map.map((c) => [`${c.position.x},${c.position.y}`, c] as const));

        // Check walkable
        for (const p of covered) {
            const cell = cellByKey.get(`${p.x},${p.y}`);
            if (!cell) return false;
            if (!cell.isWalkable) return false;
        }

        // Check collision with existing objects
        for (const o of objects) {
            const occ = this.getCoveredPositions(o.position, o.size);
            if (this.positionsIntersect(covered, occ)) return false;
        }

        return true;
    }

    // Filter out object to remove
    private removeObjectByPosition(position: Vec2): MapObject[] {
        return this.editorMap().objects.filter((o) => {
            const covered = this.getCoveredPositions(o.position, o.size);
            return !covered.some((p) => p.x === position.x && p.y === position.y);
        });
    }

    /* =========================================================
       Map creation & rule helpers
       ========================================================= */

    /**
     * Creates a fresh empty editor map.
     * - Used on initialization, resize, and reset.
     */
    private createEmptyMap(opts?: {
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
            id: 0,
            name,
            description,
            mode,
            size,
            date: now,
            map: cells,
            objects: [],
            visibility: true,
        };
    }

    /**
     * MapSize -> numeric dimensions.
     */
    private getDimensions(size: MapSize): { cols: number; rows: number } {
        switch (size) {
            case MapSize.S:
                return { cols: 10, rows: 10 };
            case MapSize.M:
                return { cols: 15, rows: 15 };
            case MapSize.L:
                return { cols: 20, rows: 20 };
            default:
                return { cols: 10, rows: 10 };
        }
    }

    /**
     * Default walkability by tile type.
     * Door special case:
     * - default is closed when first placed (walkable=false)
     * - toggling happens in applyTileAtIndex()
     */
    private isWalkable(tileType: TileType): boolean {
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
    private getObjectLimit(type: ObjectType, size: MapSize, mode: GameMode): number {
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
}
