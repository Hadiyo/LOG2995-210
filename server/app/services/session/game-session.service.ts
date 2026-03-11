import { InternalPlayer } from '@app/interface/player.interface';
import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { CreateSessionPayload, GameSession, JoinSessionPayload, PlayerPayload } from '@common/game/game-session.interface';
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
    async createGameSession(payload: JoinSessionPayload, socketId: string): Promise<CreateSessionPayload> {
        try {
            const mapPreviewSession = await this.gameMapService.saveGameMap(payload.id);
            const newPlayer = this.playerService.savePlayer(payload.character, socketId);

            const gameSession: GameSession = {
                id: randomUUID(),
                players: [newPlayer.id],
                mapTemplateId: mapPreviewSession.id,
                debugMode: false,
            };
            this.gameSessions.set(gameSession.id, gameSession);

            const newPayload: CreateSessionPayload = {
                mapPreview: mapPreviewSession,
                sessionId: gameSession.id,
                player: newPlayer,
            };
            return newPayload;
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
    joinGameSession(payload: JoinSessionPayload, socketId: string): PlayerPayload | undefined {
        try {
            const player = this.playerService.savePlayer(payload.character, socketId);
            const session = this.findSessionByPreview(payload.id);
            if (session && player) {
                session.players.push(player.id);
                this.gameMapService.updateNumberOfPlayers(payload.id, 1);
                const internalPlayer = this.getPlayerFromGameSession(player.id); // Verification
                const playerPayload: PlayerPayload = {
                    player: internalPlayer.player,
                    sessionId: session.id,
                    mapPreviewId: session.mapTemplateId,
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
        const session = this.findSessionByPreview(sessionPreviewId);
        this.gameMapService.deleteGameMap(session.id);
        this.gameMapService.deleteGameMapPreview(session.id);
        this.gameSessions.delete(session.id);
    }

    /**
     * Finds a session id by the preview template
     * @param previewId 
     */
    private findSessionByPreview(previewId: string): GameSession | undefined {
        for (const session of this.gameSessions.values()) {
            if (session.mapTemplateId.includes(previewId)) {
                return session;
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
