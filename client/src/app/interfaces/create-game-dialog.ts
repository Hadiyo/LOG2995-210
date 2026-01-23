import { GameMode, MapSize } from '@common/enum';

export interface CreateGameDialogResult {
  size: MapSize;
  mode: GameMode;
}
