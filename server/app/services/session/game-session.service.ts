import { InternalPlayer } from '@app/interface/player.interface';
import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { CreateSessionPayload, GameSession, GameSessionPayload, PlayerPayload } from '@common/game/game-session.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class GameSessionService {
    /** HOLDS ALL GAME AND COMBAT SESSIONS WITH REFERENCES TO THE GAME-MAP TEMPLATES AND PLAYERS */
    private gameSessions = new Map<string, GameSession>();
    private readonly logger: Logger;

    constructor(
        private readonly playerService: PlayerService,
        private readonly gameMapService: GameMapService,
    ) {
        this.logger = new Logger(GameSessionService.name);
    }

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
    async createGameSession(mapId: string): Promise<CreateSessionPayload> {
        try {
            const mapPreview = await this.gameMapService.saveGameMap(mapId);
            const gameSession: GameSession = {
                id: randomUUID(),
                players: [],
                mapTemplateId: mapPreview.id,
                debugMode: false,
            };
            this.gameSessions.set(gameSession.id, gameSession);
            return { mapPreview, sessionId: gameSession.id };
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
    addPlayerToSession(payload: GameSessionPayload, socketId: string): PlayerPayload | undefined {
        try {
            const playerId = this.playerService.savePlayer(payload.information, socketId);
            const session = this.gameSessions.get(payload.sessionId);
            if (session && playerId) {
                session.players.push(playerId);
                const internalPlayer = this.getPlayerFromGameSession(playerId); // Verification
                const playerPayload: PlayerPayload = {
                    player: internalPlayer.player,
                    sessionId: session.id,
                };
                return playerPayload;
            } else return undefined;
        } catch (err) {
            this.logger.error(`Error while joining game session: ${err}`);
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
    deleteGameSession(sessionPreviewId: string): void {
        const sessionId = this.findSessionByPreview(sessionPreviewId);
        this.gameMapService.deleteGameMap(sessionId);
        this.gameMapService.deleteGameMapPreview(sessionId);
        this.gameSessions.delete(sessionId);
    }

    /**
     * Retrieves session id 
     * @param sessionPreviewId 
     * @param delta 
     * @returns 
     */
    updateGameSession(sessionPreviewId: string, delta: number): string {
        const sessionId = this.findSessionByPreview(sessionPreviewId);
        this.gameMapService.updateNumberOfPlayers(sessionPreviewId, delta);
        return sessionId;
    }

    /**
     * Finds a session id by the preview template
     * @param previewId 
     */
    private findSessionByPreview(previewId: string): string | undefined {
        this.logger.log(this.gameSessions);
        for (const session of this.gameSessions.values()) {
            if (session.mapTemplateId.includes(previewId)) {
                return session.id;
            }
        }
        return undefined;
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
