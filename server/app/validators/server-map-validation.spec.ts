import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { validateMap } from '@common/maps/map-validation';
import { GameMode, MapSize } from '@common/maps/map.enums';
import type { EditorMap } from '@common/maps/map.interface';
import type { Model } from 'mongoose';


/**
 * Testing Strategy:
 * - Verify that createNameUniquenessChecker correctly handles
 *   empty names, case sensitivity options, regex escaping,
 *   exclusion of specific IDs, and existing duplicates.
 *
 * - Ensure database queries are constructed properly
 *   depending on the provided options.
 *
 * - Validate that validateMapOnServer merges base validation
 *   results with server-side name uniqueness checks.
 *
 * - Confirm that NAME_NOT_UNIQUE is added only when appropriate
 *   and that the uniqueness checker is not called when the name is empty.
 */

jest.mock('@common/maps/map-validation', () => ({
    validateMap: jest.fn(),
}));

describe('server-map-validation', () => {
    const validateMapMock = validateMap as jest.Mock;

    const makeMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
        id: '',
        name: 'Map',
        description: 'Desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: '',
        map: [],
        objects: [],
        visibility: true,
        ...overrides,
    });

    beforeEach(() => {
        validateMapMock.mockReturnValue({ isValid: true, issues: [] });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createNameUniquenessChecker()', () => {
        it('should return false for empty names without querying DB', async () => {
            const model = { exists: jest.fn() } as unknown as Model<{ name: string }>;
            const isUnique = createNameUniquenessChecker(model);

            await expect(isUnique('   ')).resolves.toBe(false);
            expect(model.exists).not.toHaveBeenCalled();
        });

        it('should query DB case-insensitively by default and exclude an id when provided', async () => {
            const model = { exists: jest.fn().mockResolvedValue(null) } as unknown as Model<{ name: string }>;
            const isUnique = createNameUniquenessChecker(model, { excludeId: 'abc' });

            await expect(isUnique('  map.*  ')).resolves.toBe(true);

            expect(model.exists).toHaveBeenCalledTimes(1);
            expect(model.exists).toHaveBeenCalledWith({
                name: { $regex: '^map\\.\\*$', $options: 'i' },
                _id: { $ne: 'abc' },
            });
        });

        it('should query DB case-sensitively when caseInsensitive=false', async () => {
            const model = { exists: jest.fn().mockResolvedValue(null) } as unknown as Model<{ name: string }>;
            const isUnique = createNameUniquenessChecker(model, { caseInsensitive: false });

            await expect(isUnique('  My Map  ')).resolves.toBe(true);

            expect(model.exists).toHaveBeenCalledWith({ name: 'My Map' });
        });

        it('should return false when a matching record exists', async () => {
            const model = { exists: jest.fn().mockResolvedValue({ _id: '1' }) } as unknown as Model<{ name: string }>;
            const isUnique = createNameUniquenessChecker(model);

            await expect(isUnique('Map')).resolves.toBe(false);
        });
    });

    describe('validateMapOnServer()', () => {
        it('should merge base validation issues and add NAME_NOT_UNIQUE when needed', async () => {
            validateMapMock.mockReturnValueOnce({
                isValid: false,
                issues: [{ code: 'NAME_REQUIRED', message: 'base' }],
            });

            const isNameUnique = jest.fn().mockResolvedValue(false);
            const result = await validateMapOnServer(makeMap({ name: 'Map' }), isNameUnique);

            expect(isNameUnique).toHaveBeenCalledWith('Map');
            expect(result.isValid).toBe(false);
            expect(result.issues.map((issue) => issue.code)).toEqual(['NAME_REQUIRED', 'NAME_NOT_UNIQUE']);
        });

        it('should not call uniqueness checker when name is empty', async () => {
            validateMapMock.mockReturnValueOnce({
                isValid: false,
                issues: [{ code: 'NAME_REQUIRED', message: 'base' }],
            });

            const isNameUnique = jest.fn().mockResolvedValue(false);
            const result = await validateMapOnServer(makeMap({ name: '   ' }), isNameUnique);

            expect(isNameUnique).not.toHaveBeenCalled();
            expect(result.issues.map((issue) => issue.code)).toEqual(['NAME_REQUIRED']);
        });

        it('should not add NAME_NOT_UNIQUE when unique', async () => {
            validateMapMock.mockReturnValueOnce({ isValid: true, issues: [] });
            const isNameUnique = jest.fn().mockResolvedValue(true);

            const result = await validateMapOnServer(makeMap({ name: '  Unique  ' }), isNameUnique);

            expect(isNameUnique).toHaveBeenCalledWith('Unique');
            expect(result).toEqual({ isValid: true, issues: [] });
        });
    });
});
