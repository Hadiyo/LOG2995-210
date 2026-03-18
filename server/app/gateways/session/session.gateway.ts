import { pageRoomMap } from '@app/gateways/rooms.record';
import { GameSessionService } from '@app/services/session/game-session.service';
import { JoinSessionPayload } from '@common/game/game-session.interface';
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

      this.leavePreviousGameRooms(client);
      client.join(gameInformation.waitingRoom.sessionId);

      if (!client.rooms.has(gameInformation.waitingRoom.sessionId)) {
        this.logger.error(`Player ${client.id} failed to join room ${gameInformation.waitingRoom.sessionId}`);
        return;
      }
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.NewAvailableSession, gameInformation.mapPreview);
      client.emit(RoomSocketEvents.PlayerJoinedGame);
      client.emit(WaitingRoomEvents.ClientJoinedSession, gameInformation.waitingRoom);
    } catch (err) {
      this.logger.error(
        `Error creating session for client ${client.id}: ${err.message}`,
        err.stack,
      );
      client.emit(ErrorSocketEvents.ServerError);
    }
  }

  @SubscribeMessage(RoomSocketEvents.JoinGameRoom)
  joinGameSession(@MessageBody() previewId: string, @ConnectedSocket() client: Socket) {
    const session = this.sessionService.findSessionByPreview(previewId);
    if(session){
      client.join(session.id); // Connect client to the room
      const players = this.sessionService.getPlayersFromGamePreview(previewId);
      client.emit(WaitingRoomEvents.InitPlayers, players); // Send a copy 
    }
  }

  @SubscribeMessage(RoomSocketEvents.AddPlayerToSession)
  addPlayerToSession(@MessageBody() payload: JoinSessionPayload, @ConnectedSocket() client: Socket) {
    const waitingRoom = this.sessionService.joinGameSession(payload, client.id);
    if (waitingRoom) {
      this.leavePreviousGameRooms(client);
      client.join(waitingRoom.sessionId); // Connect client to the room
      client.emit(RoomSocketEvents.PlayerJoinedGame); // Signal waiting room redirection
      client.emit(WaitingRoomEvents.ClientJoinedSession, waitingRoom); // Send full payload so client knows which player is themselves
      client.to(waitingRoom.sessionId).emit(WaitingRoomEvents.PlayerJoinedSession, waitingRoom.clientPlayer); // Send the new player information only
      this.server
        .to(waitingRoom.sessionId)
        .emit(WaitingRoomEvents.WaitingRoomState, waitingRoom);
      this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.IncrementPlayerCount, waitingRoom.mapPreviewId); // increment player count in join-page for that session
    }
  }

  @SubscribeMessage(RoomSocketEvents.LeaveSession)
  leaveSession(@MessageBody() previewId: string, @ConnectedSocket() client: Socket) {
    const session = this.sessionService.findSessionByPreview(previewId);
    if(session && client.rooms.has(session.id))
      client.leave(session.id);
  }

  private leavePreviousGameRooms(client: Socket): void {
    const pageRooms = new Set<string>(Object.values(pageRoomMap));
    for (const room of client.rooms) {
      if (room === client.id || pageRooms.has(room)) {
        continue;
      }

      client.leave(room);
    }
  }
}
