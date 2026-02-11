import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapObject } from '@common/interface';
import { validateMap } from '@common/map-validation';

describe('common map-validation (validateMap)', () => {
    const makeCell = (x: number, y: number, tileType: TileType): EditorCell => ({
        position: { x, y },
        tileType,
        isWalkable: true,
        isOccupied: false,
    });

    const makeObject = (type: ObjectType, x: number, y: number, id = 1): MapObject => ({
        id,
        type,
        position: { x, y },
        size: ObjectSize.S,
    });

    const makeEditorMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
        id: '',
        name: 'Valid',
        description: 'Valid desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: '',
        visibility: true,
        map: [makeCell(0, 0, TileType.DIRT)],
        objects: [makeObject(ObjectType.START, 0, 0, 1), makeObject(ObjectType.START, 0, 0, 2)],
        ...overrides,
    });

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
                map: [makeCell(0, 0, TileType.DIRT), makeCell(1, 0, TileType.WALL)],
            }),
        );
        expect(issueCodes(result)).toContain('TERRAIN_RATIO_TOO_LOW');
    });

    it('should not report TERRAIN_RATIO_TOO_LOW when terrain is above 50%', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    makeCell(0, 0, TileType.DIRT),
                    makeCell(1, 0, TileType.DIRT),
                    makeCell(2, 0, TileType.WALL),
                ],
            }),
        );
        expect(issueCodes(result)).not.toContain('TERRAIN_RATIO_TOO_LOW');
    });

    it('should report DOOR_INVALID_PLACEMENT when a door is on an edge (missing neighbors)', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    makeCell(0, 0, TileType.DIRT),
                    makeCell(0, 1, TileType.DOOR),
                    makeCell(1, 0, TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should report DOOR_INVALID_PLACEMENT when a door is surrounded by terrain', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    makeCell(0, 0, TileType.DIRT),
                    makeCell(1, 0, TileType.DIRT),
                    makeCell(2, 0, TileType.DIRT),
                    makeCell(0, 1, TileType.DIRT),
                    makeCell(1, 1, TileType.DOOR),
                    makeCell(2, 1, TileType.DIRT),
                    makeCell(0, 2, TileType.DIRT),
                    makeCell(1, 2, TileType.DIRT),
                    makeCell(2, 2, TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should accept a door between horizontal walls and vertical terrain', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    makeCell(0, 0, TileType.DIRT),
                    makeCell(1, 0, TileType.DIRT),
                    makeCell(2, 0, TileType.DIRT),
                    makeCell(0, 1, TileType.WALL),
                    makeCell(1, 1, TileType.DOOR),
                    makeCell(2, 1, TileType.WALL),
                    makeCell(0, 2, TileType.DIRT),
                    makeCell(1, 2, TileType.DIRT),
                    makeCell(2, 2, TileType.DIRT),
                ],
            }),
        );
        expect(issueCodes(result)).not.toContain('DOOR_INVALID_PLACEMENT');
    });

    it('should accept a door between vertical walls and horizontal terrain', () => {
        const result = validateMap(
            makeEditorMap({
                map: [
                    makeCell(0, 0, TileType.DIRT),
                    makeCell(1, 0, TileType.WALL),
                    makeCell(2, 0, TileType.DIRT),
                    makeCell(0, 1, TileType.DIRT),
                    makeCell(1, 1, TileType.DOOR),
                    makeCell(2, 1, TileType.DIRT),
                    makeCell(0, 2, TileType.DIRT),
                    makeCell(1, 2, TileType.WALL),
                    makeCell(2, 2, TileType.DIRT),
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

    it('should report FLAG_MISSING when mode is CTF and flag is not placed', () => {
        const result = validateMap(
            makeEditorMap({
                mode: GameMode.CTF,
                objects: [makeObject(ObjectType.START, 0, 0, 1), makeObject(ObjectType.START, 0, 0, 2)],
            }),
        );
        expect(issueCodes(result)).toContain('FLAG_MISSING');
    });

    it('should report FLAG_NOT_ALLOWED when mode is CLASSIC and a flag is present', () => {
        const result = validateMap(
            makeEditorMap({
                mode: GameMode.CLASSIC,
                objects: [
                    makeObject(ObjectType.START, 0, 0, 1),
                    makeObject(ObjectType.START, 0, 0, 2),
                    makeObject(ObjectType.FLAG, 0, 0, 1),
                ],
            }),
        );
        expect(issueCodes(result)).toContain('FLAG_NOT_ALLOWED');
    });

    it('should not add UNREACHABLE_TILES when there are no traversable tiles', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(0, 0, TileType.WALL)],
            }),
        );
        expect(issueCodes(result)).not.toContain('UNREACHABLE_TILES');
    });

    it('should not add UNREACHABLE_TILES when there are no start points', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(0, 0, TileType.DIRT), makeCell(1, 0, TileType.DIRT)],
                objects: [],
            }),
        );
        expect(issueCodes(result)).not.toContain('UNREACHABLE_TILES');
    });

    it('should report UNREACHABLE_TILES when traversable tiles are disconnected', () => {
        const result = validateMap(
            makeEditorMap({
                map: [makeCell(0, 0, TileType.DIRT), makeCell(2, 0, TileType.DIRT)],
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
                map: [makeCell(0, 0, TileType.DIRT)],
                objects: [makeObject(ObjectType.START, 1, 0, 1), makeObject(ObjectType.START, 1, 0, 2)],
            }),
        );
        expect(issueCodes(result)).toContain('UNREACHABLE_TILES');
    });
});
