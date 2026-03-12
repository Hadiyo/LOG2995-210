import { pageRoomMap } from '@app/gateways/rooms.record';
import { PlayerService } from '@app/services/player/player.service';
import { GameSessionService } from '@app/services/session/game-session.service';
import { GameStartedPayload, WaitingRoomRedirectPayload } from '@common/game/game-session.interface';
import { ErrorSocketEvents, RoomSocketEvents, WaitingRoomEvents } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    namespace: '/api',
})
export class WaitingRoomGateway {
    @WebSocketServer()
    private server: Server;
    private readonly logger: Logger;

    constructor(
        private readonly sessionService: GameSessionService,
        private readonly playerService: PlayerService,
    ) {
        this.logger = new Logger(WaitingRoomGateway.name);
    }

    /**
     * Removes the requesting player from their game session and notifies the room.
     */
    @SubscribeMessage(WaitingRoomEvents.LeaveGameRoom)
    leaveGameSession(@ConnectedSocket() client: Socket): void {
        const internalPlayer = this.playerService.getPlayerBySocketId(client.id);
        if (!internalPlayer) {
            this.logger.error(`No player found for socket ${client.id}`);
            return;
        }

        const player = internalPlayer.player;
        const sessionId = this.sessionService.leaveGameSession(player.id);

        if (!sessionId) {
            this.logger.error(`Player ${player.id} does not belong to any game session`);
            return;
        }

        client.leave(sessionId);
        this.server.to(sessionId).emit(WaitingRoomEvents.PlayerLeftSession, player.information);

        const session = this.sessionService.getGameSessionById(sessionId);
        if (session) {
            this.server.to(sessionId).emit(WaitingRoomEvents.WaitingRoomState, this.sessionService.getWaitingRoomState(sessionId));
            this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.DecrementPlayerCount, session.mapTemplateId);
        }
    }

    /**
     * Deletes the entire game session (organizer only).
     * The session is identified from the organizer's socket room membership.
     */
    @SubscribeMessage(WaitingRoomEvents.DeleteGameSession)
    deleteGameSession(@ConnectedSocket() client: Socket): void {
        try {
            const sessionId = this.getSessionIdFromSocket(client);
            if (!sessionId) {
                this.logger.error(`Could not find session for socket ${client.id}`);
                return;
            }

            const session = this.sessionService.getGameSessionById(sessionId);
            if (!session) {
                this.logger.error(`Session ${sessionId} not found`);
                return;
            }

            this.sessionService.deleteGameSession(session.mapTemplateId);
            // Notify all players in the session room that it was deleted
            const payload: WaitingRoomRedirectPayload = {
                reason: 'La salle d\'attente a ete fermee parce que l\'organisateur a quitte.',
            };
            this.server.to(sessionId).emit(WaitingRoomEvents.GameSessionDeleted, payload);
            // Notify the join-game page to remove the session from the list
            this.server.to(pageRoomMap.joinGame).emit(WaitingRoomEvents.GameSessionDeleted, session.mapTemplateId);
        } catch (err) {
            client.emit(ErrorSocketEvents.FailedSessionDeletion);
            this.logger.error(`Error deleting the game session: ${err}`);
        }
    }

    /**
     * Kicks a player from the session by name (organizer only).
     */
    @SubscribeMessage(WaitingRoomEvents.KickPlayer)
    kickPlayer(@MessageBody() playerName: string, @ConnectedSocket() client: Socket): void {
        const sessionId = this.getSessionIdFromSocket(client);
        if (!sessionId) {
            this.logger.error(`Could not find session for socket ${client.id}`);
            return;
        }

        const target = this.playerService.getPlayerByName(playerName);
        if (!target) {
            this.logger.error(`No player found with name ${playerName}`);
            return;
        }

        const removedSessionId = this.sessionService.leaveGameSession(target.player.id);
        if (!removedSessionId) {
            return;
        }
        // Notify the kicked player individually
        this.server.in(target.socketId).socketsLeave(sessionId);

        const redirectPayload: WaitingRoomRedirectPayload = {
            reason: `Vous avez ete exclu de la salle d'attente par l'organisateur.`,
        };
        this.server.to(target.socketId).emit(WaitingRoomEvents.KickedFromSession, redirectPayload);
        // Notify the rest of the room
        this.server.to(sessionId).emit(WaitingRoomEvents.PlayerLeftSession, target.player.information);

        const session = this.sessionService.getGameSessionById(sessionId);
        if (session) {
            this.server.to(sessionId).emit(WaitingRoomEvents.WaitingRoomState, this.sessionService.getWaitingRoomState(sessionId));
            this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.DecrementPlayerCount, session.mapTemplateId);
        }
    }

    @SubscribeMessage(WaitingRoomEvents.StartGame)
    startGame(@ConnectedSocket() client: Socket): void {
        const sessionId = this.getSessionIdFromSocket(client);
        if (!sessionId) {
            return;
        }

        const internalPlayer = this.playerService.getPlayerBySocketId(client.id);
        if (!internalPlayer?.player.information.isOrganizer) {
            return;
        }

        const payload: GameStartedPayload | undefined = this.sessionService.startGameSession(sessionId);
        if (!payload) {
            client.emit(ErrorSocketEvents.ServerError, 'Impossible de demarrer la partie.');
            return;
        }

        this.server.to(sessionId).emit(WaitingRoomEvents.GameStarted, payload);
    }

    private getSessionIdFromSocket(client: Socket): string | undefined {
        for (const room of client.rooms) {
            if (room !== client.id) {
                return room;
            }
        }
        return undefined;
    }
}
