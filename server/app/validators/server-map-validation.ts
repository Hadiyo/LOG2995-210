import type { FilterQuery, Model } from 'mongoose';

import type { EditorMap } from '@common/interface';
import {
    type MapValidationIssue,
    type MapValidationResult,
    validateMap,
} from '@common/map-validation';

export type MapNameUniquenessChecker = (name: string) => Promise<boolean>;

export interface NameUniquenessOptions {
    excludeId?: string;
    caseInsensitive?: boolean;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const trimName = (name: string): string => name.trim();

const isEmptyName = (name: string): boolean => trimName(name).length === 0;

const buildCaseSensitiveFilter = <T extends { name: string }>(name: string): FilterQuery<T> => ({
    name,
});

const buildCaseInsensitiveFilter = <T extends { name: string }>(name: string): FilterQuery<T> => ({
    name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
});

const buildNameFilter = <T extends { name: string }>(
    name: string,
    caseInsensitive: boolean,
): FilterQuery<T> =>
    caseInsensitive ? buildCaseInsensitiveFilter<T>(name) : buildCaseSensitiveFilter<T>(name);

const withExcludeId = <T>(
    filter: FilterQuery<T>,
    excludeId?: string,
): FilterQuery<T> => {
    if (!excludeId) return filter;
    (filter as FilterQuery<T> & { _id?: unknown })._id = { $ne: excludeId };
    return filter;
};

export const createNameUniquenessChecker = <T extends { name: string }>(
    model: Model<T>,
    options: NameUniquenessOptions = {},
): MapNameUniquenessChecker => {
    const { excludeId, caseInsensitive = true } = options;

    return async (name: string): Promise<boolean> => {
        if (isEmptyName(name)) return false;

        const trimmed = trimName(name);
        const filter = withExcludeId(buildNameFilter<T>(trimmed, caseInsensitive), excludeId);
        const existing = await model.exists(filter);
        return existing === null;
    };
};

const addNameUniquenessIssue = async (
    map: EditorMap,
    isNameUnique: MapNameUniquenessChecker,
    issues: MapValidationIssue[],
): Promise<void> => {
    if (isEmptyName(map.name)) return;

    const unique = await isNameUnique(trimName(map.name));
    if (unique) return;

    issues.push({
        code: 'NAME_NOT_UNIQUE',
        message: 'Le nom de la carte doit etre unique.',
    });
};

export const validateMapOnServer = async (
    map: EditorMap,
    isNameUnique: MapNameUniquenessChecker,
): Promise<MapValidationResult> => {
    const base = validateMap(map);
    const issues: MapValidationIssue[] = [...base.issues];

    await addNameUniquenessIssue(map, isNameUnique, issues);

    return { isValid: issues.length === 0, issues };
};
