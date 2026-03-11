import { GameMode, MapSize, ObjectType, TileType } from '../maps/map.enums';
import { EditorMap, Vec2 } from '../maps/map.interface';
import { getCellPositionAtIndex } from './map-utils';

export type MapValidationIssueCode =
    | 'NAME_REQUIRED'
    | 'DESCRIPTION_REQUIRED'
    | 'NAME_NOT_UNIQUE'
    | 'TERRAIN_RATIO_TOO_LOW'
    | 'START_POINTS_MISSING'
    | 'FLAG_MISSING'
    | 'FLAG_NOT_ALLOWED'
    | 'DOOR_INVALID_PLACEMENT'
    | 'UNREACHABLE_TILES';

export interface MapValidationIssue {
    code: MapValidationIssueCode;
    message: string;
    details?: Record<string, unknown>;
}

export interface MapValidationResult {
    isValid: boolean;
    issues: MapValidationIssue[];
}

const TERRAIN_TILES = new Set<TileType>([TileType.DIRT, TileType.WATER, TileType.ICE]);

export const STARTS_REQUIRED_BY_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 2,
    [MapSize.M]: 4,
    [MapSize.L]: 6,
};

const MIN_TERRAIN_RATIO = 0.5;

const FLAGS_REQUIRED_BY_MODE: Record<GameMode, number> = {
    [GameMode.CLASSIC]: 0,
    [GameMode.CTF]: 1,
};

const isTerrainTile = (tileType: TileType): boolean => TERRAIN_TILES.has(tileType);

const isWallTile = (tileType: TileType): boolean => tileType === TileType.WALL;

const isDoorTile = (tileType: TileType): boolean => tileType === TileType.DOOR;

const positionToKey = (position: Vec2): string => `${position.x},${position.y}`;

const keyToPosition = (key: string): Vec2 => {
    const pos: string[] = key.split(",");
    return { x: parseInt(pos[0]), y: parseInt(pos[1]) };
};

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

type Cell = EditorMap['map'][number];

const buildCellMap = (cells: Cell[], mapSize: MapSize): Map<string, Cell> => {
    const map = new Map<string, Cell>();
    for (const [index, cell] of cells.entries()) {
        map.set(positionToKey(getCellPositionAtIndex(index, mapSize)), cell);
    }
    return map;
};

const getTileType = (cellsByKey: Map<string, Cell>, x: number, y: number): TileType | undefined =>
    cellsByKey.get(positionToKey({ x: x, y: y }))?.tileType;

const getNeighborKeys = (pos: Vec2): string[] => [
    positionToKey({ x: pos.x - 1, y: pos.y }),
    positionToKey({ x: pos.x + 1, y: pos.y }),
    positionToKey({ x: pos.x, y: pos.y - 1 }),
    positionToKey({ x: pos.x, y: pos.y + 1 }),
];

const getInvalidDoorPositions = (cellsByKey: Map<string, Cell>): Vec2[] => {
    const invalid: Vec2[] = [];

    for (const [key, cell] of cellsByKey) {
        if (!isDoorTile(cell.tileType)) {
            continue;
        }

        const { x: x, y: y } = keyToPosition(key);
        const left = getTileType(cellsByKey, x - 1, y);
        const right = getTileType(cellsByKey, x + 1, y);
        const up = getTileType(cellsByKey, x, y - 1);
        const down = getTileType(cellsByKey, x, y + 1);

        if (left === undefined || right === undefined || up === undefined || down === undefined) {
            invalid.push({ x, y });
            continue;
        }

        const horizontalWalls = isWallTile(left) && isWallTile(right);
        const verticalWalls = isWallTile(up) && isWallTile(down);
        const horizontalTerrain = isTerrainTile(left) && isTerrainTile(right);
        const verticalTerrain = isTerrainTile(up) && isTerrainTile(down);

        const validPlacement = (horizontalWalls && verticalTerrain) || (verticalWalls && horizontalTerrain);
        if (!validPlacement) {
            invalid.push({ x, y });
        }
    }

    return invalid;
};

const collectTraversableKeys = (cellsByKey: Map<string, Cell>): Set<string> => {
    const traversable = new Set<string>();
    for (const [key, cell] of cellsByKey) {
        if (isTerrainTile(cell.tileType) || isDoorTile(cell.tileType)) {
            traversable.add(key);
        }
    }
    return traversable;
};

const traverseFrom = (startKey: string, traversable: Set<string>, cellsByKey: Map<string, Cell>): Set<string> => {
    if (!traversable.has(startKey)) return new Set();

    const visited = new Set<string>();
    const queue: string[] = [startKey];

    for (let index = 0; index < queue.length; index++) {
        const currentKey = queue[index];
        if (visited.has(currentKey)) continue;
        visited.add(currentKey);

        const cell = cellsByKey.get(currentKey);
        if (!cell) continue;

        for (const neighbor of getNeighborKeys(keyToPosition(currentKey))) {
            if (!traversable.has(neighbor) || visited.has(neighbor)) continue;
            queue.push(neighbor);
        }
    }

    return visited;
};

const addNameIssues = (map: EditorMap, issues: MapValidationIssue[]): void => {
    if (!isNonEmpty(map.name)) {
        issues.push({
            code: 'NAME_REQUIRED',
            message: 'Le nom de la carte est requis.',
        });
    }
};

const addDescriptionIssues = (map: EditorMap, issues: MapValidationIssue[]): void => {
    if (!isNonEmpty(map.description)) {
        issues.push({
            code: 'DESCRIPTION_REQUIRED',
            message: 'La description de la carte est requise.',
        });
    }
};

const addTerrainRatioIssues = (map: EditorMap, issues: MapValidationIssue[]): void => {
    const totalTiles = map.map.length;
    if (totalTiles === 0) return;

    const terrainTiles = map.map.reduce((count, cell) => (isTerrainTile(cell.tileType) ? count + 1 : count), 0);
    const terrainRatio = terrainTiles / totalTiles;

    if (terrainRatio <= MIN_TERRAIN_RATIO) {
        issues.push({
            code: 'TERRAIN_RATIO_TOO_LOW',
            message: 'Plus de 50% de la carte doit etre des tuiles de terrain.',
            details: { terrainTiles, totalTiles },
        });
    }
};

const addDoorPlacementIssues = (cellsByKey: Map<string, Cell>, issues: MapValidationIssue[]): void => {
    const invalidDoors = getInvalidDoorPositions(cellsByKey);
    if (invalidDoors.length === 0) return;

    issues.push({
        code: 'DOOR_INVALID_PLACEMENT',
        message: "Les portes doivent etre entre des murs sur un axe et du terrain sur l'autre.",
        details: { positions: invalidDoors },
    });
};

const addStartPointIssues = (map: EditorMap, issues: MapValidationIssue[]): void => {
    const requiredStarts = STARTS_REQUIRED_BY_SIZE[map.size];
    const startCount = map.objects.filter((object) => object.type === ObjectType.START).length;

    if (startCount !== requiredStarts) {
        issues.push({
            code: 'START_POINTS_MISSING',
            message: 'Tous les points de depart doivent etre places.',
            details: { required: requiredStarts, actual: startCount },
        });
    }
};

const addFlagIssues = (map: EditorMap, issues: MapValidationIssue[]): void => {
    const requiredFlags = FLAGS_REQUIRED_BY_MODE[map.mode];
    const flagCount = map.objects.filter((object) => object.type === ObjectType.FLAG).length;

    if (requiredFlags > 0 && flagCount !== requiredFlags) {
        issues.push({
            code: 'FLAG_MISSING',
            message: 'Le drapeau doit etre place en mode CTF.',
            details: { required: requiredFlags, actual: flagCount },
        });
    }

    if (requiredFlags === 0 && flagCount > 0) {
        issues.push({
            code: 'FLAG_NOT_ALLOWED',
            message: 'Le drapeau est autorise uniquement en mode CTF.',
            details: { actual: flagCount },
        });
    }
};

const collectUnreachablePositions = (
    traversable: Set<string>,
    reachable: Set<string>,
    cellsByKey: Map<string, Cell>,
): Vec2[] => {
    const unreachable: Vec2[] = [];
    for (const key of traversable) {
        if (reachable.has(key)) continue;
        const cell = cellsByKey.get(key);
        if (cell) unreachable.push(keyToPosition(key));
    }
    return unreachable;
};

const addReachabilityIssues = (map: EditorMap, cellsByKey: Map<string, Cell>, issues: MapValidationIssue[]): void => {
    const traversable = collectTraversableKeys(cellsByKey);
    if (traversable.size === 0) return;

    const startPositions = map.objects
        .filter((object) => object.type === ObjectType.START)
        .map((object) => positionToKey(object.position));

    if (startPositions.length === 0) return;

    const reachable = traverseFrom(startPositions[0], traversable, cellsByKey);
    if (reachable.size === traversable.size) return;

    const unreachable = collectUnreachablePositions(traversable, reachable, cellsByKey);
    issues.push({
        code: 'UNREACHABLE_TILES',
        message: 'Toutes les tuiles de terrain et de porte doivent etre accessibles depuis chaque point de depart.',
        details: { unreachableCount: unreachable.length, positions: unreachable },
    });
};

export const validateMap = (map: EditorMap): MapValidationResult => {
    const issues: MapValidationIssue[] = [];

    addNameIssues(map, issues);
    addDescriptionIssues(map, issues);
    addTerrainRatioIssues(map, issues);

    const cellsByKey = buildCellMap(map.map, map.size);
    addDoorPlacementIssues(cellsByKey, issues);
    addStartPointIssues(map, issues);
    addFlagIssues(map, issues);
    addReachabilityIssues(map, cellsByKey, issues);

    return { isValid: issues.length === 0, issues };
};
