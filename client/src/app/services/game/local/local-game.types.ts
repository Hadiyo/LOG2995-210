import { EditorMap } from '@common/maps/map.interface';
import { Player } from '@common/player/player.interface';

export interface CreateLocalSessionParams {
    map: EditorMap;
    players: Player[];
    turnDurationSeconds?: number;
    debugMode?: boolean;
}
