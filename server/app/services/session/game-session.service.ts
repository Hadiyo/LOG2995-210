import { InternalPlayer } from '@app/interface/player.interface';
import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { CreateSessionPayload, GameSession, GameSessionPayload } from '@common/game/game-session.interface';
import { Player } from '@common/player/player.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class GameSessionService {
    /** HOLDS ALL GAME AND COMBAT SESSIONS WITH REFERENCES TO THE GAME-MAP TEMPLATES AND PLAYERS */
    private gameSessions = new Map<string, GameSession>();

    private playerService: PlayerService;
    private gameMapService: GameMapService;

    private readonly logger = new Logger(GameSessionService.name);

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
    async createGameSession(payload: CreateSessionPayload, socketId: string): Promise<string | null> {
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
                debugMode: false,
            };

            // TODO: CALL THE CHAT INIT METHOD WITH THE SESSION ID

            this.gameSessions.set(gameSession.id, gameSession);

            return gameSession.id;
        } catch (err) {
            this.logger.error(`Error while creating game session: ${err}`);
        }
    }

    /**
     * Links the client to the game session and initializes its player
     * @param gameSessionId 
     * @param socketId 
     * @returns the gameSessionId for the client to connect to in the gateway
     */
    joinGameSession(payload: GameSessionPayload, socketId: string): Player | undefined {
        try {
            const playerId = this.playerService.savePlayer(payload.information, socketId);
            const session = this.gameSessions.get(payload.sessionId);
            if (session && playerId) {
                session.players.push(playerId);
                const internalPlayer = this.getPlayerFromGameSession(playerId);
                return internalPlayer.player;
            } else return undefined;
        } catch (err) {
            this.logger.error(`Error while joining game session: ${err}`);
            return undefined;
        }
    }

    /**
     * @param playerId 
     * @returns the session in which the player is in
     */
    leaveGameSession(playerId: string): string | undefined {
        try {
            const sessionId = this.findPlayerInGameSession(playerId);
            if (sessionId) {
                this.playerService.removePlayer(playerId);
                return sessionId;
            } else return undefined;
        } catch (err) {
            this.logger.error(`Error while leaving game session: ${err}`);
        }
    }

    /**
     * Requests deletion of gameMap, map preview and deletes game session reference
     * @param sessionId 
     */
    deleteGameSession(sessionId: string): void {
        this.gameMapService.deleteGameMap(sessionId);
        this.gameMapService.deleteGameMapPreview(sessionId);
        this.gameSessions.delete(sessionId);
    }

    /**
     * Retreives the game sessionId win which the player is into
     * @returns the session id of the game in which the player is in
     */
    private findPlayerInGameSession(playerId: string): string | undefined {
        for (const session of this.gameSessions.values()) {
            if (session.players.includes(playerId)) {
                return session.id;
            }
        }
        return undefined;
    }

    /**
     * Retrieves player from a gameSession
     * @param playerId 
     * @returns InternalPlayer if in a game session otherwise undefined
     */
    private getPlayerFromGameSession(playerId: string): InternalPlayer | undefined {
        for (const session of this.gameSessions.values()) {
            if (session.players.includes(playerId)) {
                return this.playerService.getPlayerById(playerId);
            }
        }
        return undefined;
    }
}
