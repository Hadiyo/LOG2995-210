import { GameMap } from '@common/maps/map.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GameMapService {
    /**  HOLDS ALL MAP TEMPLATE USED IN GAMES AND LOGIC */
    private gameMaps = new Map<string, GameMap>();

    getGameMapById(id: string): GameMap {
        return this.gameMaps.get(id);
    }
}
