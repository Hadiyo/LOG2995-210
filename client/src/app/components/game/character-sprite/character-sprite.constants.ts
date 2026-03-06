// Canvas clear origin.
export const CANVAS_CLEAR_X = 0;
export const CANVAS_CLEAR_Y = 0;

// Canvas and spritesheet layout.
export const MIN_CANVAS_SIZE = 1;
export const SPRITE_GRID_COLS = 4;
export const SPRITE_GRID_ROWS = 4;

// Default component inputs.
export const DEFAULT_AVATAR_ID = 0;
export const DEFAULT_SPRITE_SIZE = 96;
export const DEFAULT_SCALE = 1;

// Spritesheet path builder.
const SPRITE_PATH_PREFIX = 'assets/avatars/sheets/sprite-';
const SPRITE_PATH_SUFFIX = '.png';
export const FALLBACK_AVATAR_ID = DEFAULT_AVATAR_ID;

// For a given avatarId, returns the path to its spritesheet image.
export const getSpriteSheetPath = (avatarId: number): string =>
    `${SPRITE_PATH_PREFIX}${avatarId}${SPRITE_PATH_SUFFIX}`;
