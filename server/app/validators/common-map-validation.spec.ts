import { getCellPositionAtIndex } from '@common/maps/map-utils';
import { validateMap } from '@common/maps/map-validation';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import type { EditorCell, EditorMap, MapObject } from '@common/maps/map.interface';

/**
 * Testing Strategy:
 * - Validate the expected behavior when all map rules are satisfied.
 *
 * - Cover invalid inputs and boundary conditions such as:
 *   empty name/description, insufficient terrain ratio,
 *   incorrect door placement, and invalid start point counts.
 *
 * - Verify game-mode-specific constraints (CTF flag required,
 *   flag forbidden in CLASSIC mode).
 *
 * - Ensure connectivity rules are enforced by detecting
 *   unreachable traversable tiles and validating detailed
 *   error reporting.
 */

describe('common map-validation (validateMap)', () => {
    const threeByThreeMapSize = Number('3') as MapSize;
    const fourByFourMapSize = Number('4') as MapSize;

    const makeCell = (xOrTileType: number | TileType, yOrTileType?: number | TileType, maybeTileType?: TileType): EditorCell => {
        const tileType = typeof xOrTileType === 'number' ? (maybeTileType as TileType) : xOrTileType;
        const position = typeof xOrTileType === 'number' ? { x: xOrTileType, y: yOrTileType as number } : { x: 0, y: 0 };
        return {
            position,
            tileType,
            isWalkable: tileType !== TileType.WALL && tileType !== TileType.DOOR,
            isOccupied: false,
        };
    };

    const makeObject = (type: ObjectType, x: number, y: number, id = 1, size: ObjectSize = ObjectSize.S): MapObject => ({
        id,
        type,
        position: { x, y },
        size,
    });

    const makeEditorMap = (overrides: Partial<EditorMap> = {}): EditorMap => {
        const size = overrides.size ?? MapSize.S;
        const rawMap = overrides.map ?? [makeCell(TileType.DIRT)];
        const positionedMap = rawMap.map((cell, index) => ({
            ...cell,
            position: getCellPositionAtIndex(index, size),
        }));

        return {
            id: '',
            name: 'Valid',
            description: 'Valid desc',
            mode: GameMode.CLASSIC,
            size,
            date: '',
            visibility: true,
            objects: [makeObject(ObjectType.START, 0, 0, 1), makeObject(ObjectType.START, 0, 0, 2)],
            ...overrides,
            map: positionedMap,
        };
    };

    const issueCodes = (result: ReturnType<typeof validateMap>): string[] => result.issues.map((i) => i.code);

    it('should return isValid=true when all rules are satisfied', () => {
        const result = validateMap(makeEditorMap());
        expect(result.isValid).toBe(true);
        expect(result.issues).toEqual([]);
    });

    it('should report NAME_REQUIRED and DESCRIPTION_REQUIRED when blank', () => {
        const result = validateMap(makeEditorMap({ name: '   ', description: '  ' }));
        expect(issueCodes(result)).toContain('NAME_REQUIRED');
        expect(issueCodes(result)).toContain('DESCRIPTION_REQUIRED');
    });

    it('should skip terrain ratio validation when there are no tiles', () => {
        const result = validateMap(makeEditorMap({ map: [] }));
        expect(issueCodes(result)).not.toContain('TERRAIN_RATIO_TOO_LOW');
    });

    it('should report TERRAIN_RATIO_TOO_LOW when terrain is 50% or less', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(TileType.DIRT), makeCell(TileType.WALL)],
            }),
        );
        expect(issueCodes(result)).toContain('TERRAIN_RATIO_TOO_LOW');
    });

    it('should not report TERRAIN_RATIO_TOO_LOW when terrain is above 50%', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.WALL),
                ],
            }),
        );
        expect(issueCodes(result)).not.toContain('TERRAIN_RATIO_TOO_LOW');
    });

    it('should report DOOR_INVALID_PLACEMENT when a door is on an edge (missing neighbors)', () => {
        const CUSTOM_MAP_SIZE = 2 as MapSize; // 2x2 grid
        const result = validateMap(
            makeEditorMap({
                size: CUSTOM_MAP_SIZE,
                map: [
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DOOR),
                    makeCell(TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should report DOOR_INVALID_PLACEMENT when a door is surrounded by terrain', () => {
        // To test create a smaller test map with only necessary tiles
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const CUSTOM_MAP_SIZE = 3 as MapSize;
        const result = validateMap(
            makeEditorMap({
                size: CUSTOM_MAP_SIZE,
                map: [
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DOOR),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should validate door placement from array order even when cell positions are malformed', () => {
        const malformedMap = makeEditorMap({
            size: threeByThreeMapSize,
            map: [
                makeCell(TileType.WALL),
                makeCell(TileType.DIRT),
                makeCell(TileType.WALL),
                makeCell(TileType.DIRT),
                makeCell(TileType.DOOR),
                makeCell(TileType.DIRT),
                makeCell(TileType.DIRT),
                makeCell(TileType.DIRT),
                makeCell(TileType.DIRT),
            ],
        });

        malformedMap.map = [
            { ...malformedMap.map[0], position: { x: 0, y: 1 } },
            { ...malformedMap.map[1], position: { x: 1, y: 0 } },
            { ...malformedMap.map[2], position: { x: 2, y: 1 } },
            { ...malformedMap.map[3], position: { x: 1, y: 2 } },
            { ...malformedMap.map[4], position: { x: 1, y: 1 } },
            { ...malformedMap.map[5], position: { x: 0, y: 0 } },
            { ...malformedMap.map[6], position: { x: 2, y: 0 } },
            { ...malformedMap.map[7], position: { x: 0, y: 2 } },
            { ...malformedMap.map[8], position: { x: 2, y: 2 } },
        ];

        const result = validateMap(malformedMap);

        expect(issueCodes(result)).toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should accept a door between horizontal walls and vertical terrain', () => {
        // To test create a smaller test map with only necessary tiles
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const CUSTOM_MAP_SIZE = 3 as MapSize;
        const result = validateMap(
            makeEditorMap({
                size: CUSTOM_MAP_SIZE,
                map: [
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.WALL),
                    makeCell(TileType.DOOR),
                    makeCell(TileType.WALL),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).not.toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should accept a door between vertical walls and horizontal terrain', () => {
        // To test create a smaller test map with only necessary tiles
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const CUSTOM_MAP_SIZE = 3 as MapSize;
        const result = validateMap(
            makeEditorMap({
                size: CUSTOM_MAP_SIZE,
                map: [
                    makeCell(TileType.DIRT),
                    makeCell(TileType.WALL),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DOOR),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT),
                    makeCell(TileType.WALL),
                    makeCell(TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).not.toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should report START_POINTS_MISSING when the number of start points is not correct for the size', () => {
        const result = validateMap(
            makeEditorMap({
                size: MapSize.M,
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 0, 0, 2),
                ],
            }),
        );
        expect(issueCodes(result)).toContain('START_POINTS_MISSING');
    });

    it('should report FLAG_MISSING when mode is CTF and no flag is placed', () => {
        const result = validateMap(
            makeEditorMap({
                mode: GameMode.CTF,
            }),
        );

        expect(issueCodes(result)).toContain('FLAG_MISSING');
    });

    it('should report FLAG_NOT_ALLOWED when mode is CLASSIC and a flag is present', () => {
        const result = validateMap(
            makeEditorMap({
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 1, 0, 2),
                    makeObject(ObjectType.FLAG, 2, 0, 2),
                ],
            }),
        );

        expect(issueCodes(result)).toContain('FLAG_NOT_ALLOWED');
    });

    it('should report FLAG_ON_DOOR_NOT_ALLOWED when a flag is placed on an open door', () => {
        const result = validateMap(
            makeEditorMap({
                mode: GameMode.CTF,
                map: [
                    { ...makeCell(0, 0, TileType.DOOR), isWalkable: true },
                    makeCell(1, 0, TileType.DIRT),
                ],
                objects: [
                    makeObject(ObjectType.START, 1, 0, 1),
                    makeObject(ObjectType.START, 1, 0, 2),
                    makeObject(ObjectType.FLAG, 0, 0, 2),
                ],
            }),
        );

        expect(issueCodes(result)).toContain('FLAG_ON_DOOR_NOT_ALLOWED');
    });

    it('should report START_ON_OPEN_DOOR_NOT_ALLOWED when a start is placed on an open door', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    { ...makeCell(0, 0, TileType.DOOR), isWalkable: true },
                    makeCell(1, 0, TileType.DIRT),
                ],
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 1, 0, 2),
                ],
            }),
        );

        expect(issueCodes(result)).toContain('START_ON_OPEN_DOOR_NOT_ALLOWED');
    });

    it('should report DOOR_DOORWAY_BLOCKED when a blocking object covers a doorway tile', () => {
        const fiveByFiveMapSize = Number('5') as MapSize;
        const result = validateMap(
            makeEditorMap({
                size: fiveByFiveMapSize,
                map: [
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.WALL), makeCell(TileType.WALL), makeCell(TileType.DOOR), makeCell(TileType.WALL), makeCell(TileType.WALL),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                ],
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 1, 0, 2),
                    makeObject(ObjectType.REGEN, 1, 2, 2, ObjectSize.L), // covers (1,2),(2,2),(1,3),(2,3) — blocks south doorway
                ],
            }),
        );

        expect(issueCodes(result)).toContain('DOOR_DOORWAY_BLOCKED');
    });

    it('should not report DOOR_DOORWAY_BLOCKED when blocking objects do not touch doorway tiles', () => {
        const fiveByFiveMapSize = Number('5') as MapSize;
        const result = validateMap(
            makeEditorMap({
                size: fiveByFiveMapSize,
                map: [
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.WALL), makeCell(TileType.WALL), makeCell(TileType.DOOR), makeCell(TileType.WALL), makeCell(TileType.WALL),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                ],
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 1, 0, 2),
                    makeObject(ObjectType.REGEN, 0, 2, 2, ObjectSize.L), // covers (0,2),(1,2),(0,3),(1,3) — NOT near doorway
                ],
            }),
        );

        expect(issueCodes(result)).not.toContain('DOOR_DOORWAY_BLOCKED');
    });

    it('should not add UNREACHABLE_TILES when there are no traversable tiles', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(TileType.WALL)],
            }),
        );
        expect(issueCodes(result)).not.toContain('UNREACHABLE_TILES');
    });

    it('should not add UNREACHABLE_TILES when there are no start points', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(TileType.DIRT), makeCell(TileType.DIRT)],
                objects: [],
            }),
        );
        expect(issueCodes(result)).not.toContain('UNREACHABLE_TILES');
    });

    it('should report UNREACHABLE_TILES when traversable tiles are disconnected', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(TileType.DIRT), makeCell(TileType.WALL), makeCell(TileType.DIRT)],
                objects: [makeObject(ObjectType.START, 0, 0, 1), makeObject(ObjectType.START, 0, 0, 2)],
            }),
        );
        expect(issueCodes(result)).toContain('UNREACHABLE_TILES');
        const issue = result.issues.find((i) => i.code === 'UNREACHABLE_TILES');
        expect(issue?.details).toEqual({
            unreachableCount: 1,
            positions: [{ x: 2, y: 0 }],
        });
    });

    it('should report UNREACHABLE_TILES when the first start is not on a traversable tile', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(TileType.DIRT)],
                objects: [makeObject(ObjectType.START, 1, 0, 1), makeObject(ObjectType.START, 1, 0, 2)],
            }),
        );
        expect(issueCodes(result)).toContain('UNREACHABLE_TILES');
    });

    it('should treat sanctuary footprints as blocked when validating reachable tiles', () => {
        const result = validateMap(
            makeEditorMap({
                size: fourByFourMapSize,
                map: [
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.WALL), makeCell(TileType.WALL), makeCell(TileType.DIRT), makeCell(TileType.WALL),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                    makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT), makeCell(TileType.DIRT),
                ],
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 1, 0, 2),
                    makeObject(ObjectType.REGEN, 2, 0, 2, ObjectSize.L),
                ],
            }),
        );

        expect(issueCodes(result)).toContain('UNREACHABLE_TILES');
    });
});
