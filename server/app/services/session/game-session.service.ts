import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { GameSessionSnapshot, TurnPhase } from '@common/game-session';
import {
    GameSession,
    GameSessionPreview,
    GameStartedPayload,
    JoinSessionPayload,
    PlayerPayload,
    WaitingRoom,
} from '@common/game/game-session.interface';
import { PlayerInformation } from '@common/player/player.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

const TURN_DURATION_SECONDS = 30;

@Injectable()
export class GameSessionService {
    /** HOLDS ALL GAME AND COMBAT SESSIONS WITH REFERENCES TO THE GAME-MAP TEMPLATES AND PLAYERS */
    gameSessions = new Map<string, GameSession>();
    private readonly logger: Logger;

    constructor(
        private readonly playerService: PlayerService,
        private readonly gameMapService: GameMapService,
    ) {
        this.logger = new Logger(GameSessionService.name);
    }

    getGameSessionById(id: string): GameSession | undefined {
        return this.gameSessions.get(id);
    }

    getWaitingRoomState(sessionId: string): WaitingRoom | undefined {
        const session = this.getGameSessionById(sessionId);
        if (!session) return undefined;

        return {
            sessionId: session.id,
            mapPreviewId: session.mapTemplateId,
            players: this.getPlayersFromGameSession(session.id),
            messages: [...session.messages],
            isLocked: session.isLocked,
            maxPlayers: session.maxPlayers,
        };
    }

    /**
     * 1. Calls GameMapService to create a gameMap from the mapId and retrieves mapTemplateId
     * to store it in the current GameSession
     * 2. Calls PlayerService to create the player from the input player information and returns
     * playerId to be stored in the current GameSession
     * 3. Stores the new gameSession object in gameSession
     * @returns gameSessionId (for the client socket to join the room)
     */

    async createGameSession(payload: JoinSessionPayload, socketId: string): Promise<PlayerPayload | undefined> {
        try {
            const mapPreviewSession = await this.gameMapService.saveGameMap(payload.id);
            const newPlayer = this.playerService.savePlayer(payload.character, socketId);

            const gameSession: GameSession = {
                id: randomUUID(),
                players: [newPlayer.id],
                mapTemplateId: mapPreviewSession.id,
                debugMode: false,
                isLocked: mapPreviewSession.nbOfPlayers >= mapPreviewSession.maxPlayers,
                maxPlayers: mapPreviewSession.maxPlayers,
                messages: [],
                hasStarted: false,
            };

            this.gameSessions.set(gameSession.id, gameSession);

            const waitingRoomPayload = this.generateWaitingRoomPayload(gameSession, 
                [newPlayer.information], newPlayer.information, mapPreviewSession);
            return {
                waitingRoom: waitingRoomPayload,
                mapPreview: mapPreviewSession,
            };
        } catch (err) {
            this.logger.error(`Error while creating game session: ${err}`);
            return undefined;
        }
    }

    /**
     * Links the client to the game session and initializes its player
     * @returns the waiting room payload for the client
     */
    joinGameSession(payload: JoinSessionPayload, socketId: string): WaitingRoom | undefined {
        try {
            const session = this.findSessionByPreview(payload.id);
            if (!session) {
                return undefined;
            }

            const player = this.playerService.savePlayer(payload.character, socketId);
            session.players.push(player.id);
            this.syncSessionLockState(session);
            this.gameMapService.updateNumberOfPlayers(payload.id, 1);
            const preview = this.gameMapService.getPreviewById(session.mapTemplateId);
            const players = this.getPlayersFromGameSession(session.id);
            const waitingRoom = this.generateWaitingRoomPayload(session, players, player.information, preview);

            return waitingRoom;
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
            if (!sessionId) {
                return undefined;
            }

            const session = this.gameSessions.get(sessionId);
            if (!session) {
                return undefined;
            }

            session.players = session.players.filter((id) => id !== playerId);
            this.syncSessionLockState(session);
            this.gameMapService.updateNumberOfPlayers(session.mapTemplateId, -1);
            this.playerService.removePlayer(playerId);
            return sessionId;
        } catch (err) {
            this.logger.error(`Error while leaving game session: ${err}`);
            return undefined;
        }
    }

    canStartGame(sessionId: string): boolean {
        const session = this.gameSessions.get(sessionId);
        if (!session) return false;
        return !session.hasStarted;
    }

    startGameSession(sessionId: string): GameStartedPayload | undefined {
        const session = this.gameSessions.get(sessionId);
        if (!session || !this.canStartGame(sessionId)) {
            return undefined;
        }

        const gameMap = this.gameMapService.getGameMapById(session.mapTemplateId);
        if (!gameMap) {
            return undefined;
        }

        const players = this.playerService.createRuntimePlayers(session.players, gameMap);
        const activePlayerId = players[0]?.id ?? '';
        const snapshot: GameSessionSnapshot = {
            id: session.id,
            map: {
                ...gameMap,
                map: gameMap.map.map((cell) => ({ ...cell })),
                objects: gameMap.objects.map((object) => ({ ...object })),
            },
            players,
            turn: {
                order: players.map((player) => player.id),
                activePlayerId,
                turnNumber: 1,
                remainingSeconds: TURN_DURATION_SECONDS,
                totalSeconds: TURN_DURATION_SECONDS,
                phase: TurnPhase.Turn,
            },
            messages: [...session.messages],
            debugMode: session.debugMode ?? false,
            createdAt: new Date().toISOString(),
        };

        session.hasStarted = true;
        return { snapshot };
    }

    /**
     * Requests deletion of gameMap, map preview and deletes game session reference
     */
    deleteGameSession(sessionPreviewId: string): void {
        const session = this.findSessionByPreview(sessionPreviewId);
        if (!session) {
            return;
        }

        this.gameMapService.deleteGameMap(session.mapTemplateId);
        this.gameMapService.deleteGameMapPreview(session.mapTemplateId);
        this.gameSessions.get(session.id).players.forEach((playerId) => this.playerService.removePlayer(playerId));
        this.gameSessions.delete(session.id);
    }

    /**
     * Method to create a Waiting Room payload
     * @param session 
     * @param sessionPlayers 
     * @param player 
     * @param preview 
     * @returns 
     */
    private generateWaitingRoomPayload(session: GameSession, 
        sessionPlayers: PlayerInformation[], 
        player: PlayerInformation, preview: GameSessionPreview): WaitingRoom {
        return {
            players: sessionPlayers,
            clientPlayer: player,
            sessionId: session.id,
            mapPreviewId: session.mapTemplateId,
            messages: session.messages ?? [],
            isLocked: session.isLocked ?? false,
            maxPlayers: session.maxPlayers ?? preview.maxPlayers,
      };

    }

    /**
     * Finds a session id by the preview template
     */
    private findSessionByPreview(previewId: string): GameSession | undefined {
        for (const session of this.gameSessions.values()) {
            if (session.mapTemplateId === previewId) {
                return session;
            }
        }
        return undefined;
    }

    /**
     * Retreives the game sessionId win which the player is into
     * @returns the session id of the game in which the player is in
     */
    findPlayerInGameSession(playerId: string): string | undefined {
        for (const session of this.gameSessions.values()) {
            if (session.players.includes(playerId)) {
                return session.id;
            }
        }
        return undefined;
    }

    /**
     * Retrieves players from a gameSession
     */
    private getPlayersFromGameSession(sessionId: string): PlayerInformation[] {
        const session = this.gameSessions.get(sessionId);
        if (!session) return [];

        return session.players
            .map((playerId) => this.playerService.getPlayerById(playerId)?.player.information)
            .filter((player): player is PlayerInformation => Boolean(player));
    }

    private syncSessionLockState(session: GameSession): void {
        session.isLocked = session.players.length >= session.maxPlayers;
        this.gameMapService.updatePreviewLockState(session.mapTemplateId, session.isLocked);
    }

}
