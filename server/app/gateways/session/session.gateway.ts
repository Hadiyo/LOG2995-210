import { SessionService } from '@app/services/session/session.service';
import { CreateSessionPayload, GameSessionPayload } from '@common/game/game-session.interface';
import { ErrorSocketEvents, RoomSocketEvents, SocketRoom } from '@common/socket-events';
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
@WebSocketGateway()
export class SessionGateway {
  private readonly mapSessionRoom: SocketRoom = SocketRoom.MapManagementRoom;
  private readonly sessionService: SessionService;

  constructor(private readonly logger: Logger = new Logger(SessionGateway.name)) {}

  @SubscribeMessage(RoomSocketEvents.JoinSessionRoom)
  joinMapSession(@ConnectedSocket() client: Socket) {
    client.join(this.mapSessionRoom);
    if (client.rooms.has(this.mapSessionRoom)) {
      this.logger.log(`Client ${client.id} joined ${this.mapSessionRoom} successfully`);
    }
  }

  @SubscribeMessage(RoomSocketEvents.LeaveSessionRoom)
  leaveMapSession(@ConnectedSocket() client: Socket) {
    client.leave(this.mapSessionRoom);
    if (!client.rooms.has(this.mapSessionRoom)) {
      this.logger.log(`Client ${client.id} left ${this.mapSessionRoom} successfully`);
    }
  }

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
    } catch (err) {
      this.logger.error(
        `Error creating session for player ${client.id}: ${err.message}`,
        err.stack,
      );
      client.emit(ErrorSocketEvents.ServerError);
    }
  }

  @SubscribeMessage(RoomSocketEvents.JoinGameRoom)
  joinGameSession(@MessageBody() payload: GameSessionPayload, @ConnectedSocket() client: Socket) {
    const hasJoinedGame = this.sessionService.joinGameSession(payload, client.id);

    if (!hasJoinedGame)
      client.emit(ErrorSocketEvents.FailedJoinSession);

    // TODO: NOTIFY OTHER PLAYERS IN THE SESSION THAT PLAYER WITH PLAYERID LEFT THE ROOM
  }


  @SubscribeMessage(RoomSocketEvents.LeaveGameRoom)
  leaveGameSession(@MessageBody() playerId: string, @ConnectedSocket() client: Socket) {
    const sessionId = this.sessionService.leaveGameSession(playerId);
    if (!sessionId) {
      this.logger.error('The player does not belong to any game session');
      return;
    }
    client.leave(sessionId);
    // TODO: NOTIFY OTHER PLAYERS IN THE SESSION THAT PLAYER WITH PLAYERID LEFT THE ROOM
  }
}
