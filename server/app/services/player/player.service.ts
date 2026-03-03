import { Player } from '@common/player/player.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PlayerService {
    /** HOLD ALL PLAYERS AND THEIR REFERENCE TO THE GAME THEY ARE IN */
    private players = new Map<string, Player>();

    getPlayerById(id: string): Player {
        return this.players.get(id);
    }
}
