import { GameMapService } from '@app/services/game-map/game-map.service';
import { PlayerService } from '@app/services/player/player.service';
import { GameSessionSnapshot, TurnPhase } from '@common/game-session';
import {
    CreateSessionPayload,
    GameSession,
    GameStartedPayload,
    JoinSessionPayload,
    PlayerPayload,
    WaitingRoomStatePayload,
} from '@common/game/game-session.interface';
import { ObjectType } from '@common/maps/map.enums';
import { GameCell, GameMap } from '@common/maps/map.interface';
import { Player, PlayerInformation, PlayerStatus } from '@common/player/player.interface';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

const TURN_DURATION_SECONDS = 30;
const DEFAULT_ACTIONS_PER_TURN = 1;

@Injectable()
export class GameSessionService {
    /** HOLDS ALL GAME AND COMBAT SESSIONS WITH REFERENCES TO THE GAME-MAP TEMPLATES AND PLAYERS */
    public gameSessions = new Map<string, GameSession>();
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

    getWaitingRoomState(sessionId: string): WaitingRoomStatePayload | undefined {
        const session = this.getGameSessionById(sessionId);
        if (!session) return undefined;

        return {
            sessionId: session.id,
            mapPreviewId: session.mapTemplateId,
            players: this.getPlayersFromGameSession(session.id),
            messages: [...session.messages],
            isLocked: session.isLocked,
            maxPlayers: session.maxPlayers,
            minPlayersToStart: 0,
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
    async createGameSession(payload: JoinSessionPayload, socketId: string): Promise<CreateSessionPayload | undefined> {
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

            return {
                mapPreview: mapPreviewSession,
                sessionId: gameSession.id,
                player: newPlayer,
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
    joinGameSession(payload: JoinSessionPayload, socketId: string): PlayerPayload | undefined {
        try {
            const session = this.findSessionByPreview(payload.id);
            if (!session) {
                return undefined;
            }

            const player = this.playerService.savePlayer(payload.character, socketId);
            session.players.push(player.id);
            this.syncSessionLockState(session);
            this.gameMapService.updateNumberOfPlayers(payload.id, 1);

            return {
                players: this.getPlayersFromGameSession(session.id),
                clientPlayer: player.information,
                sessionId: session.id,
                mapPreviewId: session.mapTemplateId,
                messages: [...session.messages],
                isLocked: session.isLocked,
                maxPlayers: session.maxPlayers,
            };
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

        const players = this.createRuntimePlayers(session.players, gameMap);
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
        this.gameSessions.delete(session.id);
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
    public findPlayerInGameSession(playerId: string): string | undefined {
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

    private createRuntimePlayers(playerIds: string[], gameMap: GameMap): Player[] {
        const spawnPositions = gameMap.objects
            .filter((object) => object.type === ObjectType.START)
            .map((object) => ({ ...object.position }));
        const walkablePositions = gameMap.map
            .filter((cell) => cell.isWalkable)
            .map((cell) => ({ ...cell.position }));

        return playerIds
            .map((playerId) => this.playerService.getPlayerById(playerId)?.player)
            .filter((player): player is Player => Boolean(player))
            .map((player, index) => ({
                ...player,
                information: { ...player.information },
                state: {
                    ...player.state,
                    position: this.getInitialPosition(index, spawnPositions, walkablePositions),
                    status: PlayerStatus.Active,
                    remainingActions: DEFAULT_ACTIONS_PER_TURN,
                    remainingMovements: player.state.attributes.speed,
                },
                render: {
                    ...player.render,
                    facing: player.render.facing ?? 'front',
                    pose: player.render.pose ?? 'idle',
                },
            }));
    }

    private getInitialPosition(
        index: number,
        spawnPositions: { x: number; y: number }[],
        walkablePositions: GameCell['position'][],
    ): GameCell['position'] {
        return (
            spawnPositions[index] ??
            walkablePositions[index] ??
            walkablePositions[0] ??
            { x: 0, y: 0 }
        );
    }
}
