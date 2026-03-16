// UI constants for the game view component
export const GAME_VIEW_CONSTANTS = {
  minGridDimension: 1,
  messageMaxLength: 200,
  defaultPanelTitle: 'N/A',
  avatarSpriteSize: 96,
} as const;

// Timing constants (in milliseconds) for game actions and animations
export const ADJACENT_TILE_DISTANCE = 1; // Grid distance for adjacent tiles
export const WALK_VISUAL_MS = 180; // Duration of walk animation
export const ATTACK_VISUAL_MS = 220; // Duration of attack animation
export const LOCAL_POSE_REFRESH_MS = 100; // Interval to update character pose state
export const GAME_END_REDIRECT_DELAY_MS = 2800; // Delay before redirecting after game ends
