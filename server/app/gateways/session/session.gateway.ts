import { pageRoomMap } from '@app/gateways/rooms.record';
import { GameSessionService } from '@app/services/session/game-session.service';
import { JoinSessionPayload, PlayerPayload } from '@common/game/game-session.interface';
import { ErrorSocketEvents, RoomSocketEvents, WaitingRoomEvents } from '@common/socket-events';
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
        return;
      }

      client.join(gameInformation.sessionId);

      if (!client.rooms.has(gameInformation.sessionId)) {
        this.logger.error(`Player ${client.id} failed to join room ${gameInformation.sessionId}`);
        return;
      }
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.NewAvailableSession, gameInformation.mapPreview);
      client.emit(RoomSocketEvents.PlayerJoinedGame);
      const waitingRoomState = this.sessionService.getWaitingRoomState(gameInformation.sessionId);
      const waitingRoomPayload: PlayerPayload = {
        players: waitingRoomState?.players ?? [gameInformation.player.information],
        clientPlayer: gameInformation.player.information,
        sessionId: gameInformation.sessionId,
        mapPreviewId: gameInformation.mapPreview.id,
        messages: waitingRoomState?.messages ?? [],
        isLocked: waitingRoomState?.isLocked ?? false,
        maxPlayers: waitingRoomState?.maxPlayers ?? gameInformation.mapPreview.maxPlayers,
      };
      client.emit(WaitingRoomEvents.ClientJoinedSession, waitingRoomPayload);
      client.emit(WaitingRoomEvents.WaitingRoomState, waitingRoomState);
    } catch (err) {
      this.logger.error(
        `Error creating session for client ${client.id}: ${err.message}`,
        err.stack,
      );
      client.emit(ErrorSocketEvents.ServerError);
    }
  }

  @SubscribeMessage(RoomSocketEvents.JoinGameRoom)
  joinGameSession(@MessageBody() payload: JoinSessionPayload, @ConnectedSocket() client: Socket) {
    const playerPayload = this.sessionService.joinGameSession(payload, client.id);
    if (playerPayload) {
      client.join(playerPayload.sessionId); // Connect client to the room
      client.emit(RoomSocketEvents.PlayerJoinedGame); // Signal waiting room redirection
      client.emit(WaitingRoomEvents.ClientJoinedSession, playerPayload); // Send full payload so client knows which player is themselves
      client.to(playerPayload.sessionId).emit(WaitingRoomEvents.PlayerJoinedSession, playerPayload.clientPlayer); // Send the new player information only
      this.server
        .to(playerPayload.sessionId)
        .emit(WaitingRoomEvents.WaitingRoomState, this.sessionService.getWaitingRoomState(playerPayload.sessionId));
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.IncrementPlayerCount, playerPayload.mapPreviewId); // increment player count in join-page for that session
    }
  }
}
