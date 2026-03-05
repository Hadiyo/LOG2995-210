import { MapService } from '@app/services/map/map.service';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { getCellPositionAtIndex } from '@common/maps/map-utils';
import { MapSize } from '@common/maps/map.enums';
import { EditorCell, EditorMap, GameCell, GameMap } from '@common/maps/map.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

const DEFAULT_PLAYER_NUMBER = 1;

@Injectable()
export class GameMapService {
    /** Single source of truth of gameplay maps and game session previews */
    private gameMaps = new Map<string, GameMap>();
    private gameMapPreviews: GameSessionPreview[] = [];

    private mapService: MapService;
    private readonly logger = new Logger(GameMapService.name);

    getGameMapById(id: string): GameMap {
        return this.gameMaps.get(id);
    }

    getGameMapPreviews(): GameSessionPreview[] {
        return this.gameMapPreviews;
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
            const mapPreview = this.generateGameMapPreview(templateMap, gameMap.id);
            if (!gameMap || !mapPreview) {
                this.logger.log('Error while generating maps');
                return;
            }
            this.gameMaps.set(gameMap.id, gameMap);
            this.gameMapPreviews.push(mapPreview);
            return gameMap.id;
        } catch (err) {
            this.logger.error(`Error while creating GameMap: ${err}`);
        }
    }

    /**
     * Generates the map used during gameplay 
     * @param templateMap 
     * @returns GameMap
     */
    private generateGameMap(templateMap: EditorMap): GameMap {
        const gameCells = this.translateEditorCellsToGameCells(templateMap.map, templateMap.size);
        return {
            id: randomUUID(), // new ID for the in-game instance
            name: templateMap.name,
            size: templateMap.size,
            mode: templateMap.mode,
            map: gameCells,
            objects: templateMap.objects.map(obj => ({ ...obj })),
        };
    }

    /**
     * Generates the required GameMap payload for JOIN GAME PAGE
     * @param templateMap 
     * @returns GameMapPreview
     */
    private generateGameMapPreview(templateMap: EditorMap, sessionId: string): GameSessionPreview {
        return {
            id: sessionId,
            name: templateMap.name,
            description: templateMap.description,
            mode: templateMap.mode,
            size: templateMap.size,
            nbOfPlayers: DEFAULT_PLAYER_NUMBER,
            previewImage: templateMap.previewImage,
        };
    }

    /**
     * Utility method that translates index array position to vector position,
     * necessary for gameplay position logic
     * @param map 
     * @param size 
     * @returns GameCell[]
     */
    private translateEditorCellsToGameCells(map: EditorCell[], size: MapSize): GameCell[] {
        const gameMap: GameCell[] = [];

        for (const [index, cell] of map.entries()) {
            const gameCell: GameCell = {
                tileType: cell.tileType,
                isWalkable: cell.isWalkable,
                isOccupied: cell.isOccupied,
                position: getCellPositionAtIndex(index, size),
            };
            gameMap.push(gameCell);
        }
        return gameMap;
    }
}
