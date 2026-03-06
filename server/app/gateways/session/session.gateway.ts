import { pageRoomMap } from '@app/gateways/rooms.record';
import { GameSessionService } from '@app/services/session/game-session.service';
import { ChatPayload, CreateSessionPayload, GameSessionPayload } from '@common/game/game-session.interface';
import { ErrorSocketEvents, RoomSocketEvents } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
namespace: '/api',
})
export class SessionGateway {
  @WebSocketServer() private server: Server;

  private readonly sessionService: GameSessionService;

  constructor(private readonly logger: Logger = new Logger(SessionGateway.name)) {}

  @SubscribeMessage(RoomSocketEvents.CreateGameSession)
  async createGameSession(@MessageBody() payload: CreateSessionPayload, @ConnectedSocket() client: Socket) {
    try {
      const gameSessionId = await this.sessionService.createGameSession(payload, client.id);

      if (!gameSessionId) {
        this.logger.error(`Error during game session creation`);
        client.emit(ErrorSocketEvents.FailedSessionCreation);
        return;
      }

      client.join(gameSessionId);

      if (!client.rooms.has(gameSessionId)) {
        this.logger.error(`Player ${client.id} failed to join room ${gameSessionId}`);
        client.emit(ErrorSocketEvents.FailedJoinSession);
        return;
      }

      client.emit(RoomSocketEvents.GameSessionCreated, gameSessionId);
    } catch (err) {
      this.logger.error(
        `Error creating session for player ${client.id}: ${err.message}`,
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
  joinGameSession(@MessageBody() payload: GameSessionPayload, @ConnectedSocket() client: Socket) {
    const player = this.sessionService.joinGameSession(payload, client.id);

    if (!player)
      client.emit(ErrorSocketEvents.FailedJoinSession);

    // Notify other players that a newplayer has joined the session
    client.to(payload.sessionId).emit(RoomSocketEvents.PlayerJoinedGame, player);
    // Notify joinsession page to increase the number of players in this sessionId
    this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.IncrementPlayerCount, payload.sessionId);
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

  @SubscribeMessage(RoomSocketEvents.SendMessage)
  sendMessage(@MessageBody() message: ChatPayload) {
    this.sessionService.sendMessage(message);
  }
}
