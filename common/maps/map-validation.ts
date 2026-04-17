import type { EditorMap } from './map.interface';
import { createMapValidationIssues } from './map-validation.rules';
import {
    STARTS_REQUIRED_BY_SIZE,
    type MapValidationIssue,
    type MapValidationIssueCode,
    type MapValidationResult,
} from './map-validation.types';

export { STARTS_REQUIRED_BY_SIZE };
export type { MapValidationIssue, MapValidationIssueCode, MapValidationResult };

export const validateMap = (map: EditorMap): MapValidationResult => {
    const issues = createMapValidationIssues(map);
    return {
        isValid: issues.length === 0,
        issues,
    };
};
