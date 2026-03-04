import { Player } from '@common/player/player.interface';

export interface InternalPlayer {
    socketId: string;
    player: Player;
}