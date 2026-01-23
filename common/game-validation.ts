import { GameMode, MapSize, ObjectType, TileType } from './enum';
import type { EditorMap, Vec2 } from './interface';

export type GameValidationIssueCode =
    | 'NAME_REQUIRED'
    | 'DESCRIPTION_REQUIRED'
    | 'NAME_NOT_UNIQUE'
    | 'TERRAIN_RATIO_TOO_LOW'
    | 'START_POINTS_MISSING'
    | 'FLAG_MISSING'
    | 'FLAG_NOT_ALLOWED'
    | 'DOOR_INVALID_PLACEMENT'
    | 'UNREACHABLE_TILES';

export interface GameValidationIssue {
    code: GameValidationIssueCode;
    message: string;
    details?: Record<string, unknown>;
}

export interface GameValidationResult {
    isValid: boolean;
    issues: GameValidationIssue[];
}

const TERRAIN_TILES = new Set<TileType>([TileType.DIRT, TileType.WATER, TileType.ICE]);

const STARTS_REQUIRED_BY_SIZE: Record<MapSize, number> = {
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

const positionKey = (x: number, y: number): string => `${x},${y}`;

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

type Cell = EditorMap['map'][number];

const buildCellMap = (cells: Cell[]): Map<string, Cell> => {
    const map = new Map<string, Cell>();
    for (const cell of cells) {
        map.set(positionKey(cell.position.x, cell.position.y), cell);
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

const getInvalidDoorPositions = (cellsByKey: Map<string, Cell>): Vec2[] => {
    const invalid: Vec2[] = [];

    for (const cell of cellsByKey.values()) {
        if (!isDoorTile(cell.tileType)) {
            continue;
        }

        const { x, y } = cell.position;
        const left = getTileType(cellsByKey, x - 1, y);
        const right = getTileType(cellsByKey, x + 1, y);
        const up = getTileType(cellsByKey, x, y - 1);
        const down = getTileType(cellsByKey, x, y + 1);

        const horizontalWalls =
            left !== undefined && right !== undefined && isWallTile(left) && isWallTile(right);
        const verticalWalls = up !== undefined && down !== undefined && isWallTile(up) && isWallTile(down);
        const horizontalTerrain =
            left !== undefined && right !== undefined && isTerrainTile(left) && isTerrainTile(right);
        const verticalTerrain =
            up !== undefined && down !== undefined && isTerrainTile(up) && isTerrainTile(down);

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

        for (const neighbor of getNeighborKeys(cell.position)) {
            if (!traversable.has(neighbor) || visited.has(neighbor)) continue;
            queue.push(neighbor);
        }
    }

    return visited;
};

const addNameIssues = (game: EditorMap, issues: GameValidationIssue[]): void => {
    if (!isNonEmpty(game.name)) {
        issues.push({
            code: 'NAME_REQUIRED',
            message: 'Le nom du jeu est requis.',
        });
    }
};

const addDescriptionIssues = (game: EditorMap, issues: GameValidationIssue[]): void => {
    if (!isNonEmpty(game.description)) {
        issues.push({
            code: 'DESCRIPTION_REQUIRED',
            message: 'La description du jeu est requise.',
        });
    }
};

const addTerrainRatioIssues = (game: EditorMap, issues: GameValidationIssue[]): void => {
    const totalTiles = game.map.length;
    if (totalTiles === 0) return;

    const terrainTiles = game.map.reduce((count, cell) => (isTerrainTile(cell.tileType) ? count + 1 : count), 0);
    const terrainRatio = terrainTiles / totalTiles;

    if (terrainRatio <= MIN_TERRAIN_RATIO) {
        issues.push({
            code: 'TERRAIN_RATIO_TOO_LOW',
            message: 'Plus de 50% de la carte doit etre des tuiles de terrain.',
            details: { terrainTiles, totalTiles },
        });
    }
};

const addDoorPlacementIssues = (cellsByKey: Map<string, Cell>, issues: GameValidationIssue[]): void => {
    const invalidDoors = getInvalidDoorPositions(cellsByKey);
    if (invalidDoors.length === 0) return;

    issues.push({
        code: 'DOOR_INVALID_PLACEMENT',
        message: "Les portes doivent etre entre des murs sur un axe et du terrain sur l'autre.",
        details: { positions: invalidDoors },
    });
};

const addStartPointIssues = (game: EditorMap, issues: GameValidationIssue[]): void => {
    const requiredStarts = STARTS_REQUIRED_BY_SIZE[game.size];
    const startCount = game.objects.filter((object) => object.type === ObjectType.START).length;

    if (startCount !== requiredStarts) {
        issues.push({
            code: 'START_POINTS_MISSING',
            message: 'Tous les points de depart doivent etre places.',
            details: { required: requiredStarts, actual: startCount },
        });
    }
};

const addFlagIssues = (game: EditorMap, issues: GameValidationIssue[]): void => {
    const requiredFlags = FLAGS_REQUIRED_BY_MODE[game.mode];
    const flagCount = game.objects.filter((object) => object.type === ObjectType.FLAG).length;

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
        if (cell) unreachable.push(cell.position);
    }
    return unreachable;
};

const addReachabilityIssues = (game: EditorMap, cellsByKey: Map<string, Cell>, issues: GameValidationIssue[]): void => {
    const traversable = collectTraversableKeys(cellsByKey);
    if (traversable.size === 0) return;

    const startPositions = game.objects
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

export const validateGame = (game: EditorMap): GameValidationResult => {
    const issues: GameValidationIssue[] = [];

    addNameIssues(game, issues);
    addDescriptionIssues(game, issues);
    addTerrainRatioIssues(game, issues);

    const cellsByKey = buildCellMap(game.map);
    addDoorPlacementIssues(cellsByKey, issues);
    addStartPointIssues(game, issues);
    addFlagIssues(game, issues);
    addReachabilityIssues(game, cellsByKey, issues);

    return { isValid: issues.length === 0, issues };
};
