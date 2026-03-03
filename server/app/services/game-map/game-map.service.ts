import { MapService } from '@app/services/map/map.service';
import { EditorMap, GameMap } from '@common/maps/map.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class GameMapService {
    /**  HOLDS ALL MAP TEMPLATE USED IN GAMES AND LOGIC */
    private gameMaps = new Map<string, GameMap>();
    private mapService: MapService;
    private readonly logger = new Logger(GameMapService.name);

    getGameMapById(id: string): GameMap {
        return this.gameMaps.get(id);
    }

    /**
     * Creates the gameMap from the mapId. It fetches the template from the map service.
     * The gameMap is saved in gameMaps
     * @returns gameMapId
     */
    async saveGameMap(id: string): Promise<string | null> {
        try {
            const templateMap = await this.mapService.getMapById(id);
            if (!templateMap) {
                this.logger.log('Error while fetching map from the database');
                return;
            }

            const gameMap = this.generateGameMap(templateMap);

            if (!gameMap) {
                this.logger.log('Error while generating game Map');
                return;
            }

            this.gameMaps.set(gameMap.id, gameMap);
            return gameMap.id;

        } catch (err) {
            this.logger.error(`Error while creating GameMap: ${err}`);
        }

    }

    /** UTILS */
    private generateGameMap(templateMap: EditorMap): GameMap {
        const newMap: GameMap = {
            id: randomUUID(),
            name: templateMap.name,
            size: templateMap.size,
            mode: templateMap.mode,
            objects: templateMap.objects.map(obj => ({ ...obj })),
            map: templateMap.map.map(cell => ({ ...cell })),
        };

        return newMap;
    }
}
