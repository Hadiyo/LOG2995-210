import { getCellPositionAtIndex, getCoveredPositions } from './map-utils';
import { GameMode, MapSize, ObjectType, TileType } from './map.enums';
import type { EditorMap, Vec2 } from './map.interface';

export type MapValidationIssueCode =
    | 'NAME_REQUIRED'
    | 'DESCRIPTION_REQUIRED'
    | 'NAME_NOT_UNIQUE'
    | 'TERRAIN_RATIO_TOO_LOW'
    | 'START_POINTS_MISSING'
    | 'FLAG_MISSING'
    | 'FLAG_NOT_ALLOWED'
    | 'FLAG_ON_DOOR_NOT_ALLOWED'
    | 'START_ON_OPEN_DOOR_NOT_ALLOWED'
    | 'DOOR_INVALID_PLACEMENT'
    | 'DOOR_DOORWAY_BLOCKED'
    | 'SANCTUARY_ENCLOSED'
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

const FLAGS_REQUIRED_BY_MODE: Record<GameMode, number> = {
    [GameMode.CLASSIC]: 0,
    [GameMode.CTF]: 1,
};

const MIN_TERRAIN_RATIO = 0.5;

const isTerrainTile = (tileType: TileType): boolean => TERRAIN_TILES.has(tileType);

const isWallTile = (tileType: TileType): boolean => tileType === TileType.WALL;

const isDoorTile = (tileType: TileType): boolean => tileType === TileType.DOOR;

const isBlockingObjectType = (type: ObjectType): boolean => type === ObjectType.REGEN || type === ObjectType.ARENA;

const positionKey = (x: number, y: number): string => `${x},${y}`;

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

type Cell = EditorMap['map'][number];

const buildCellMap = (cells: Cell[], mapSize: MapSize): Map<string, Cell> => {
    const map = new Map<string, Cell>();
    for (const [index, cell] of cells.entries()) {
        const position = getCellPositionAtIndex(index, mapSize);
        map.set(positionKey(position.x, position.y), { ...cell, position });
    }
    return map;
};

const getTileType = (cellsByKey: Map<string, Cell>, x: number, y: number): TileType | undefined =>
    cellsByKey.get(positionKey(x, y))?.tileType;

const getNeighborKeys = (pos: Vec2): string[] => [
    positionKey(pos.x - 1, pos.y),
    positionKey(pos.x + 1, pos.y),
    positionKey(pos.x, pos.y - 1),
    positionKey(pos.x, pos.y + 1),
];

const getDoorPlacement = (position: Vec2, cellsByKey: Map<string, Cell>): 'horizontal' | 'vertical' | null => {
    const { x, y } = position;
    const left = getTileType(cellsByKey, x - 1, y);
    const right = getTileType(cellsByKey, x + 1, y);
    const up = getTileType(cellsByKey, x, y - 1);
    const down = getTileType(cellsByKey, x, y + 1);

    if (left === undefined || right === undefined || up === undefined || down === undefined) {
        return null;
    }

    const horizontalWalls = isWallTile(left) && isWallTile(right);
    const verticalWalls = isWallTile(up) && isWallTile(down);
    const horizontalTerrain = isTerrainTile(left) && isTerrainTile(right);
    const verticalTerrain = isTerrainTile(up) && isTerrainTile(down);

    if (horizontalWalls && verticalTerrain) {
        return 'vertical';
    }

    if (verticalWalls && horizontalTerrain) {
        return 'horizontal';
    }

    return null;
};

const getInvalidDoorPositions = (cellsByKey: Map<string, Cell>): Vec2[] => {
    const invalid: Vec2[] = [];

    for (const cell of cellsByKey.values()) {
        if (!isDoorTile(cell.tileType)) {
            continue;
        }

        if (getDoorPlacement(cell.position, cellsByKey) === null) {
            invalid.push(cell.position);
        }
    }

    return invalid;
};

const collectTraversableKeys = (cellsByKey: Map<string, Cell>, blockedKeys: Set<string>): Set<string> => {
    const traversable = new Set<string>();
    for (const [key, cell] of cellsByKey) {
        if ((isTerrainTile(cell.tileType) || isDoorTile(cell.tileType)) && !blockedKeys.has(key)) {
            traversable.add(key);
        }
    }
    return traversable;
};

const collectBlockedKeys = (map: EditorMap): Set<string> => {
    const blockedKeys = new Set<string>();

    for (const object of map.objects) {
        if (!isBlockingObjectType(object.type)) continue;

        for (const position of getCoveredPositions(object.position, object.size)) {
            blockedKeys.add(positionKey(position.x, position.y));
        }
    }

    return blockedKeys;
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

        for (const neighbor of getNeighborKeys(cell.position)) {
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

const getBlockedDoorwayPositions = (cellsByKey: Map<string, Cell>, blockedKeys: Set<string>): Vec2[] => {
    const blocked: Vec2[] = [];

    for (const cell of cellsByKey.values()) {
        if (!isDoorTile(cell.tileType)) continue;

        const { x, y } = cell.position;
        const doorPlacement = getDoorPlacement(cell.position, cellsByKey);
        if (doorPlacement === null) continue;

        if (doorPlacement === 'vertical') {
            if (blockedKeys.has(positionKey(x, y - 1)) && blockedKeys.has(positionKey(x, y + 1))) {
                blocked.push({ x, y });
            }
        } else {
            if (blockedKeys.has(positionKey(x - 1, y)) && blockedKeys.has(positionKey(x + 1, y))) {
                blocked.push({ x, y });
            }
        }
    }

    return blocked;
};

const addDoorwayBlockedIssues = (cellsByKey: Map<string, Cell>, blockedKeys: Set<string>, issues: MapValidationIssue[]): void => {
    const blockedDoors = getBlockedDoorwayPositions(cellsByKey, blockedKeys);
    if (blockedDoors.length === 0) return;

    issues.push({
        code: 'DOOR_DOORWAY_BLOCKED',
        message: "Un objet bloquant empeche le passage a travers une porte.",
        details: { positions: blockedDoors },
    });
};

const isSanctuaryEnclosed = (object: EditorMap['objects'][number], cellsByKey: Map<string, Cell>): boolean => {
    const coveredPositions = getCoveredPositions(object.position, object.size);
    const coveredKeys = new Set(coveredPositions.map((position) => positionKey(position.x, position.y)));
    const boundaryKeys = new Set<string>();

    for (const position of coveredPositions) {
        for (const neighborKey of getNeighborKeys(position)) {
            if (!coveredKeys.has(neighborKey)) {
                boundaryKeys.add(neighborKey);
            }
        }
    }

    return [...boundaryKeys].every((key) => {
        const cell = cellsByKey.get(key);
        return !cell || isWallTile(cell.tileType);
    });
};

const addEnclosedSanctuaryIssues = (map: EditorMap, cellsByKey: Map<string, Cell>, issues: MapValidationIssue[]): void => {
    const enclosedSanctuaries = map.objects
        .filter((object) => isBlockingObjectType(object.type))
        .filter((object) => isSanctuaryEnclosed(object, cellsByKey))
        .map((object) => object.position);

    if (enclosedSanctuaries.length === 0) return;

    issues.push({
        code: 'SANCTUARY_ENCLOSED',
        message: 'Un sanctuaire ne peut pas etre completement entoure de murs.',
        details: { positions: enclosedSanctuaries },
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

const addFlagOnDoorIssues = (map: EditorMap, cellsByKey: Map<string, Cell>, issues: MapValidationIssue[]): void => {
    const invalidFlags = map.objects
        .filter((object) => object.type === ObjectType.FLAG)
        .filter((object) => {
            const key = positionKey(object.position.x, object.position.y);
            return cellsByKey.get(key)?.tileType === TileType.DOOR;
        })
        .map((object) => object.position);

    if (invalidFlags.length === 0) return;

    issues.push({
        code: 'FLAG_ON_DOOR_NOT_ALLOWED',
        message: 'Le drapeau doit etre place sur une tuile de terrain.',
        details: { positions: invalidFlags },
    });
};

const addStartOnOpenDoorIssues = (map: EditorMap, cellsByKey: Map<string, Cell>, issues: MapValidationIssue[]): void => {
    const invalidStarts = map.objects
        .filter((object) => object.type === ObjectType.START)
        .filter((object) => {
            const key = positionKey(object.position.x, object.position.y);
            const cell = cellsByKey.get(key);
            return cell?.tileType === TileType.DOOR && cell.isWalkable;
        })
        .map((object) => object.position);

    if (invalidStarts.length === 0) return;

    issues.push({
        code: 'START_ON_OPEN_DOOR_NOT_ALLOWED',
        message: 'Un point de depart ne peut pas etre place sur une porte ouverte.',
        details: { positions: invalidStarts },
    });
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
        if (cell) unreachable.push(cell.position);
    }
    return unreachable;
};

const addReachabilityIssues = (cellsByKey: Map<string, Cell>, blockedKeys: Set<string>, map: EditorMap, issues: MapValidationIssue[]): void => {
    const traversable = collectTraversableKeys(cellsByKey, blockedKeys);
    if (traversable.size === 0) return;

    const startPositions = map.objects
        .filter((object) => object.type === ObjectType.START)
        .map((object) => positionKey(object.position.x, object.position.y));

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
    const blockedKeys = collectBlockedKeys(map);
    addDoorPlacementIssues(cellsByKey, issues);
    addDoorwayBlockedIssues(cellsByKey, blockedKeys, issues);
    addEnclosedSanctuaryIssues(map, cellsByKey, issues);
    addStartPointIssues(map, issues);
    addFlagIssues(map, issues);
    addFlagOnDoorIssues(map, cellsByKey, issues);
    addStartOnOpenDoorIssues(map, cellsByKey, issues);
    addReachabilityIssues(cellsByKey, blockedKeys, map, issues);

    return { isValid: issues.length === 0, issues };
};
