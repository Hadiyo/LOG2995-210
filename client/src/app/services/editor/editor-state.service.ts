import { computed, inject, Injectable, signal } from '@angular/core';
import { MapConfig } from '@app/config/map.config';
import { MapApiService } from '@app/services/map/map-api.service';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import type { EditorCell, EditorMap, EditorMapDetails, MapObject, ObjectCountAndLimit } from '@common/maps/map.interface';
import { MouseButton } from '@common/mouse-events.enum';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { EditorMapFactoryService } from './editor-map-factory.service';
import { EditorOccupancyService } from './editor-occupancy.service';
import { EditorPlacementRulesService } from './editor-placement-rules.service';
import type { SelectedCellInfo } from './types/selected-cell-info.type';
import { getCoveredPositions } from './utils/editor-geometry.util';

@Injectable({ providedIn: 'root' })
export class EditorStateService {
    private readonly occupancy = inject(EditorOccupancyService);
    private readonly mapFactory = inject(EditorMapFactoryService);
    private readonly rules = inject(EditorPlacementRulesService);
    private readonly mapService = inject(MapApiService);

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
    // Map snapshot for edition revert operations
    readonly editorMapSnapshot = signal<EditorMap>(this.mapFactory.createEmptyMap());

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
    }

    /**
     * Select an object to place:
     * - clears tile selection
     * - switches tool to applicator
     */
    selectObject(objectType: ObjectType): void {
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
        this.editorMap.update((currentMap) => ({ ...currentMap, name }));
    }

    setDescription(description: string): void {
        this.editorMap.update((currentMap) => ({ ...currentMap, description }));
    }

    /**
     * Change game mode.
     */
    setMode(mode: GameMode): void {
        this.editorMap.update((currentMap) => ({ ...currentMap, mode }));
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
     * Reset map content (cells + objects) from snapshot but keep size/mode/name/description.
     */
    resetMap(): void {
        this.editorMap.update(current => ({
            ...current,
            map: this.editorMapSnapshot().map,
            objects: this.editorMapSnapshot().objects,
        }));
        this.clearSelection();
    }

    /**
     * sets mode and size for a newly created map and changes local editorMap copy
     * and changes local editorMap copy.
     * @param mapConfig mode and size interface
     */
    setMapModeSize(mapConfig: MapConfig): boolean {
        try {
            const newMap = this.mapFactory.createEmptyMap({
                size: mapConfig.size,
                mode: mapConfig.mode,
            });
            this.loadMap(newMap);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Uses the EditorAPI to fetch an existing map from its id and handles
     * map creation in case of fetching error.
     * @param mapId 
     */
    loadExistingEditorMap(mapId: string): Observable<boolean> {
        return this.mapService.getMapById(mapId).pipe(
            tap((remoteMap: EditorMapDetails) => {
                this.loadMap({
                    id: remoteMap.id,
                    name: remoteMap.name,
                    description: remoteMap.description,
                    mode: remoteMap.mode,
                    size: remoteMap.mapsize,
                    map: remoteMap.map,
                    objects: remoteMap.objects,
                    date: '',
                    visibility: false,
                });
            }),
            map(() => true),
            catchError(() => of(false)), // AdminService manages error handling with AdminPage
        );
    }

    /**
     * Load a persisted map into the editor.
     * Used for both create and edit flows.
     */
    loadMap(tempMap: EditorMap): void {
        const snapshot = this.mapFactory.cloneEditorMap(tempMap);
        this.editorMapSnapshot.set(snapshot);
        this.editorMap.set(tempMap);
        this.clearSelection();
    }

    /* =========================================================
       Public API — called by Sidebar
       ========================================================= */

    /** 
    * Get count of object of a given type and its limit
    */
    getObjectCountAndLimit(type: ObjectType): ObjectCountAndLimit {
        const currentMap = this.editorMap();
        const count = currentMap.objects.filter((object) => object.type === type).length;
        const limit = this.rules.getObjectLimit(type, currentMap.size, currentMap.mode);
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
        const tempMap = this.editorMap();
        const cell = tempMap.map[index];
        if (!cell) return null;

        return this.occupancy.findObjectCoveringPosition(tempMap.objects, cell.position);
    }

    /**
     * Eraser behavior:
     * - Removes any object whose covered area includes this cell
     * (This makes erasing intuitive for 2x2 objects as well.)
     */
    eraseObjectAtIndex(index: number): void {
        this.editorMap.update((currentMap) => {
            const cell = currentMap.map[index];
            if (!cell) return currentMap;

            // Keep only objects that DO NOT cover the clicked cell
            const remaining = this.occupancy.removeObjectByPosition(
                currentMap.objects,
                cell.position,
            );

            return {
                ...currentMap,
                objects: remaining,
                map: this.occupancy.refreshOccupied(currentMap.map, remaining, currentMap.size),
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
        this.editorMap.update((currentMap) => {
            const cell = currentMap.map[index];
            if (!cell) return currentMap;

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

            let existingObjects = currentMap.objects;

            if (!nextWalkable) {
                existingObjects = this.occupancy.removeObjectByPosition(currentMap.objects, cell.position);
            }

            const updated: EditorCell = {
                ...cell,
                tileType: nextTileType,
                isWalkable: nextWalkable,
            };

            // Immutable update to keep signals predictable
            const newMap = currentMap.map.slice();
            newMap[index] = updated;

            const next = { ...currentMap, map: newMap, objects: existingObjects };
            return { ...next, map: this.occupancy.refreshOccupied(next.map, next.objects, next.size) };
        });
    }

    /**
     * Place an object anchored at the clicked cell.
     * Rules enforced here:
     * - must be on walkable tiles
     * - must fit within bounds (2x2 supported)
     * - must not collide with other objects
     * - must respect type limits (start)
     * - placing overwrites intersecting objects (by design)
     */
    private placeObjectAtIndex(index: number, type: ObjectType): void {
        if (type === ObjectType.FLAG && this.editorMap().mode !== GameMode.CTF) return;

        this.editorMap.update((currentMap) => {
            const cell = currentMap.map[index];
            if (!cell) return currentMap;

            // Objects only on walkable tiles
            if (!cell.isWalkable) return currentMap;
            if ((type === ObjectType.START || type === ObjectType.FLAG) && cell.tileType === TileType.DOOR) return currentMap;

            const anchor = cell.position;

            const size: ObjectSize =
                type === ObjectType.REGEN || type === ObjectType.ARENA ? ObjectSize.L : ObjectSize.S;

            // Enforce per-type limits based on map size + mode
            const limit = this.rules.getObjectLimit(type, currentMap.size, currentMap.mode);
            if (limit === 0) return currentMap;

            const existingOfType = currentMap.objects.filter((object) => object.type === type);
            if (existingOfType.length >= limit) return currentMap;

            // Current object list (kept as-is unless overwritten by intersection)
            const objectsFiltered = currentMap.objects;

            // Covered positions for this placement (1x1 or 2x2)
            const covered = getCoveredPositions(anchor, size);

            // Must fit inside the map
            if (!this.rules.arePositionsInBounds(covered, currentMap.size)) return currentMap;

            // Must be walkable everywhere + no collisions
            if (!this.rules.canPlaceObject(covered, objectsFiltered, currentMap, type)) return currentMap;

            // Collision policy: placement is rejected if it intersects an existing object.
            const newObj: MapObject = {
                id: this.nextObjectId(objectsFiltered),
                type,
                position: { ...anchor },
                size,
            };

            const nextObjects = [...objectsFiltered, newObj];
            return { ...currentMap, objects: nextObjects, map: this.occupancy.refreshOccupied(currentMap.map, nextObjects, currentMap.size) };
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
        for (const object of objects) max = Math.max(max, object.id);
        return max + 1;
    }
}
