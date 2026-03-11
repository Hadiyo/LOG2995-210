import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: '/api',
})
export class WaitingRoomGateway {
    @WebSocketServer()
    private server: Server;

  // @SubscribeMessage(WaitingRoomEvents.InitWaitingRoom)
  // getPlayersFromSession(@MessageBody() sessionId: string, @ConnectedSocket() client: Socket): void {
  //   // TODO: GET ALL PLAYERS FROM SESSION ID
    
  //   // SEND IT TO THE WAITING ROOM SERVER WITH SOCKET MESSAGE

  // }
  //   @SubscribeMessage(RoomSocketEvents.LeaveGameRoom)
  //   leaveGameSession(@MessageBody() playerId: string, @ConnectedSocket() client: Socket) {
  //     const sessionId = this.sessionService.leaveGameSession(playerId);
  //     if (!sessionId) {
  //       this.logger.error('The player does not belong to any game session');
  //       return;
  //     }
  //     client.leave(sessionId);
  //     //Notify other players that the player has left the game session
  //     this.server.to(sessionId).emit(RoomSocketEvents.PlayerLeftGame, playerId);
  //   }

  // @SubscribeMessage(RoomSocketEvents.DeleteGameSession)
  // deleteGameSession(@MessageBody() payload: { sessionId: string }, @ConnectedSocket() client: Socket) {
  //   try {
  //     this.sessionService.deleteGameSession(payload.sessionId);
  //     this.server.to(pageRoomMap.joinGame).emit(RoomSocketEvents.GameSessionDeleted, payload.sessionId);
  //   } catch (err) {
  //     client.emit(ErrorSocketEvents.FailedSessionDeletion);
  //     this.logger.error(`Error deleting the game session: ${err}`);
  //   }
  // }
}
