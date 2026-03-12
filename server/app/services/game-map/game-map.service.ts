import { MapService } from '@app/services/map/map.service';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { getCellPositionAtIndex } from '@common/maps/map-utils';
import { MapSize } from '@common/maps/map.enums';
import { EditorCell, EditorMap, GameCell, GameMap } from '@common/maps/map.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

const DEFAULT_PLAYER_NUMBER = 1;
const MAP_MAX_PLAYER_COUNT: Record<MapSize, number> = {
    [MapSize.S]: 2,
    [MapSize.M]: 4,
    [MapSize.L]: 6,
};

@Injectable()
export class GameMapService {
    /** Single source of truth of gameplay maps and game session previews */
    private gameMaps = new Map<string, GameMap>();
    private gameMapPreviews: GameSessionPreview[] = [];
    private readonly logger: Logger;

    constructor(private readonly mapService: MapService) {
        this.logger = new Logger(GameMapService.name);
    }

    getPreviewById(id: string): GameSessionPreview {
        return this.gameMapPreviews.find(preview => preview.id === id);
    }

    getGameMapById(id: string): GameMap {
        return this.gameMaps.get(id);
    }

    getGameMapPreviews(): GameSessionPreview[] {
        return this.gameMapPreviews;
    }

    /**
     * Increase or decrease the number of players in the game map preview
     * @param previewId 
     * @param delta 
     */
    updateNumberOfPlayers(previewId: string, delta: number): void {
        this.gameMapPreviews = this.gameMapPreviews.map(session =>
            session.id === previewId
                ? {
                    ...session,
                    nbOfPlayers: session.nbOfPlayers + delta,
                    isLocked: session.nbOfPlayers + delta >= session.maxPlayers,
                }
                : session,
        );
    }

    updatePreviewLockState(previewId: string, isLocked: boolean): void {
        this.gameMapPreviews = this.gameMapPreviews.map(session =>
            session.id === previewId
                ? { ...session, isLocked }
                : session,
        );
    }

    /**
     * Creates the gameMap from the mapId. It fetches the template from the map service.
     * The gameMap is saved in gameMaps
     * @returns gameMapId
     */
    async saveGameMap(id: string): Promise<GameSessionPreview> {
        try {
            const templateMap = await this.mapService.getMapById(id);
            if (!templateMap) {
                this.logger.log('Error while fetching map from the database');
            }
            const gameMap = this.generateGameMap(templateMap);
            const mapPreview = this.generateGameMapPreview(templateMap, gameMap.id);
            if (!gameMap || !mapPreview) {
                this.logger.log('Error while generating maps');
            }
            this.gameMaps.set(gameMap.id, gameMap);
            this.gameMapPreviews.push(mapPreview);
            return mapPreview;
        } catch (err) {
            this.logger.error(`Error while creating GameMap: ${err}`);
        }
    }

    /**
     * Delete gameMap by its Id
     * @param sessionId 
     */
    deleteGameMap(sessionId: string): void {
        this.gameMaps.delete(sessionId);
    }

    /**
     * Deletes a game preview by its id
     * @param sessionId 
     */
    deleteGameMapPreview(sessionId: string): void {
        this.gameMapPreviews = this.gameMapPreviews.filter(
            preview => preview.id !== sessionId,
        );
    }


    /**
     * Generates the map used during gameplay from the initial EditorMap
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
     * Generates the required GameMap payload for JOIN GAME PAGE from the initial EditorMap
     * @param templateMap 
     * @returns GameMapPreview
     */
    private generateGameMapPreview(templateMap: EditorMap, gameMapId: string): GameSessionPreview {
        return {
            id: gameMapId,
            name: templateMap.name,
            description: templateMap.description,
            mode: templateMap.mode,
            size: templateMap.size,
            nbOfPlayers: DEFAULT_PLAYER_NUMBER,
            maxPlayers: MAP_MAX_PLAYER_COUNT[templateMap.size],
            isLocked: DEFAULT_PLAYER_NUMBER >= MAP_MAX_PLAYER_COUNT[templateMap.size],
            previewImage: templateMap.previewImage,
            previewImageFormat: templateMap.previewImageFormat,
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
