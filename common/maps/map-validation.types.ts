import { MapSize } from './map.enums';

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

export const STARTS_REQUIRED_BY_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 2,
    [MapSize.M]: 4,
    [MapSize.L]: 6,
};
