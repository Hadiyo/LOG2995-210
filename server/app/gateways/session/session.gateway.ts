import { pageRoomMap } from '@app/gateways/rooms.record';
import { GameSessionService } from '@app/services/session/game-session.service';
import { GameSessionPayload } from '@common/game/game-session.interface';
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
  async createGameSession(@MessageBody() mapId: string, @ConnectedSocket() client: Socket) {
    try {
      const payload = await this.sessionService.createGameSession(mapId);
      if (!payload) {
        this.logger.error(`Error during game session creation`);
        client.emit(ErrorSocketEvents.FailedSessionCreation);
        return;
      }

      client.join(payload.sessionId);

      if (!client.rooms.has(payload.sessionId)) {
        this.logger.error(`Player ${client.id} failed to join room ${payload.sessionId}`);
        client.emit(ErrorSocketEvents.FailedJoinSession);
        return;
      }
      client.to(pageRoomMap.joinGame).emit(RoomSocketEvents.NewAvailableSession, payload.mapPreview);
      client.emit(RoomSocketEvents.GameSessionCreated, payload);
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
  joinGameSession(@MessageBody() sessionPreviewId: string, @ConnectedSocket() client: Socket) {
    const INCREMENT_PLAYER_COUNT = 1;
    const sessionId = this.sessionService.updateGameSession(sessionPreviewId, INCREMENT_PLAYER_COUNT);
    this.logger.log(sessionId);
    if (sessionId) {
      client.join(sessionId);
      client.emit(RoomSocketEvents.AddClientToSession, sessionId);
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.IncrementPlayerCount, sessionId);
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

  @SubscribeMessage(RoomSocketEvents.AddCharacterToPlayer)
  addPlayerCharacterToSession(@MessageBody() payload: GameSessionPayload, @ConnectedSocket() client: Socket) {
    client.emit(RoomSocketEvents.AddClientToSession, payload.sessionId); // This does not work for some reason
    const player = this.sessionService.addPlayerToSession(payload, client.id);
    if (player) {
      //TODO: Notify other players that a newplayer has joined the session (payload used in waiting room)
      void player;
    }
  }
}
