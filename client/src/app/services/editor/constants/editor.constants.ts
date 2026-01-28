import { MapSize } from '@common/enum';

/* =========================================================
   Map dimensions by size
   - Used to configure the editor grid
   ========================================================= */
export const MAP_DIMENSIONS_BY_SIZE: Record<MapSize, { cols: number; rows: number }> = {
  [MapSize.S]: { cols: 10, rows: 10 },
  [MapSize.M]: { cols: 15, rows: 15 },
  [MapSize.L]: { cols: 20, rows: 20 },
};

/* =========================================================
   Placement limits by map size
   - Enforces game rules at editor-time (prevents invalid maps)
   ========================================================= */
export const START_LIMITS_BY_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 2,
    [MapSize.M]: 4,
    [MapSize.L]: 6,
};

export const SANCTUARY_LIMITS_BY_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 1,
    [MapSize.M]: 2,
    [MapSize.L]: 4,
};

export const FLAG_LIMIT = 1;