export interface GameViewConfig {
  messageMaxLength: number;
  defaultPanelTitle: string;
  avatarSpriteSize: number;
}

// UI constants for the game view component
export const GAME_VIEW_CONSTANTS: Readonly<GameViewConfig> = {
  messageMaxLength: 200,
  defaultPanelTitle: 'N/A',
  avatarSpriteSize: 96,
};
