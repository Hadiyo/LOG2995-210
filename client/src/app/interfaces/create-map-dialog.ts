import { GameMode, MapSize } from '@common/enum';

export interface CreateMapDialogResult {
  size: MapSize;
  mode: GameMode;
}
