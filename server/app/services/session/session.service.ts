import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { GameSession, GameSessionPayload } from '@common/game/game-session.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class SessionService {
    /** HOLDS ALL GAME AND COMBAT SESSIONS WITH REFERENCES TO THE GAME-MAP TEMPLATES AND PLAYERS */
    private gameSessions = new Map<string, GameSession>();
    private playerService: PlayerService;
    private gameMapService: GameMapService;
    private readonly logger = new Logger(SessionService.name);

    getGameSessionById(id: string): GameSession {
        return this.gameSessions.get(id);
    }

    /**
     * 1. Calls GameMapService to create a gameMap from the mapId and retrieves mapTemplateId
     * to store it in the current GameSession
     * 2. Calls PlayerService to create the player from the input player information and returns
     * playerId to be stored in the current GameSession
     * 3. Stores the new gameSession object in gameSession
     * @returns gameSessionId (for the client socket to join the room)
     */
    async createGameSession(payload: GameSessionPayload, socketId: string): Promise<string | null> {
        try {
            const playerId = this.playerService.savePlayer(payload.information, socketId);
            const mapId = await this.gameMapService.saveGameMap(payload.mapId);

            if (!playerId || !mapId) {
                this.logger.error('Invalid player ID or map ID');
                return;
            }

            const gameSession: GameSession = {
                id: randomUUID(),
                players: [playerId],
                mapTemplateId: mapId,
                chatSessionId: '', // TODO: add fetch chatSession id
                debugMode: false,
            };

            this.gameSessions.set(gameSession.id, gameSession);

            return gameSession.id;
        } catch (err) {
            this.logger.error(`Error while creating game session: ${err}`);
        }
    }
}
