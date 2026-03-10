import { EditorMap } from '@common/maps/map.interface';
import { GamePlayerState } from '@common/player/player.interface';

export interface CreateLocalSessionParams {
    map: EditorMap;
    players: GamePlayerState[];
    turnDurationSeconds?: number;
    debugMode?: boolean;
}
