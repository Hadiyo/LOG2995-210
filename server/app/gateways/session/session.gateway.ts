import { pageRoomMap } from '@app/gateways/rooms.record';
import { GameSessionService } from '@app/services/session/game-session.service';
import { JoinSessionPayload } from '@common/game/game-session.interface';
import { ErrorSocketEvents, RoomSocketEvents } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
export class SessionGateway {
  @WebSocketServer()
  private server: Server;
  private readonly logger: Logger;

  constructor(private readonly sessionService: GameSessionService) {
    this.logger = new Logger(SessionGateway.name);
  }

  @SubscribeMessage(RoomSocketEvents.CreateGameSession)
  async createGameSession(@MessageBody() payload: JoinSessionPayload, @ConnectedSocket() client: Socket) {
    try {
      const gameInformation = await this.sessionService.createGameSession(payload, client.id);
      if (!gameInformation) {
        this.logger.error(`Error during game session creation`);
        client.emit(ErrorSocketEvents.FailedSessionCreation);
        return;
      }

      client.join(gameInformation.sessionId);

      if (!client.rooms.has(gameInformation.sessionId)) {
        this.logger.error(`Player ${client.id} failed to join room ${gameInformation.sessionId}`);
        client.emit(ErrorSocketEvents.FailedJoinSession);
        return;
      }
      client.to(pageRoomMap.joinGame).emit(RoomSocketEvents.NewAvailableSession, gameInformation.mapPreview);
      client.emit(RoomSocketEvents.GameSessionCreated, gameInformation);
    } catch (err) {
      this.logger.error(
        `Error creating session for client ${client.id}: ${err.message}`,
        err.stack,
      );
      client.emit(ErrorSocketEvents.ServerError);
    }
  }

  @SubscribeMessage(RoomSocketEvents.DeleteGameSession)
  deleteGameSession(@MessageBody() payload: { sessionId: string }, @ConnectedSocket() client: Socket) {
    try {
      this.sessionService.deleteGameSession(payload.sessionId);
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.GameSessionDeleted, payload.sessionId);
    } catch (err) {
      client.emit(ErrorSocketEvents.FailedSessionDeletion);
      this.logger.error(`Error deleting the game session: ${err}`);
    }
  }

  @SubscribeMessage(RoomSocketEvents.JoinGameRoom)
  joinGameSession(@MessageBody() payload: JoinSessionPayload, @ConnectedSocket() client: Socket) {
    const playerPayload = this.sessionService.joinGameSession(payload, client.id);
    if (playerPayload) {
      client.join(playerPayload.sessionId);
      client.emit(RoomSocketEvents.PlayerJoinedGame, playerPayload);
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.IncrementPlayerCount, playerPayload.mapPreviewId);
    }
  }


  @SubscribeMessage(RoomSocketEvents.LeaveGameRoom)
  leaveGameSession(@MessageBody() playerId: string, @ConnectedSocket() client: Socket) {
    const sessionId = this.sessionService.leaveGameSession(playerId);
    if (!sessionId) {
      this.logger.error('The player does not belong to any game session');
      return;
    }
    client.leave(sessionId);
    //Notify other players that the player has left the game session
    this.server.to(sessionId).emit(RoomSocketEvents.PlayerLeftGame, playerId);
  }

}
