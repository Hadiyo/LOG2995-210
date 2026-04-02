import { MapSize } from '@common/maps/map.enums';

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
