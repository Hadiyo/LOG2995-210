import { CombatService } from '@app/services/combat/combat.service';
import { CombatEvents } from '@app/services/combat/combat.service.utils';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { CombatResultSnapshot, CombatSessionSnapshot, CombatTurnSnapshot, StancePayload } from '@common/combat/combat.interface';
import { CombatSocketEvents, GameSessionErrorPayload, SessionSocketEvents, StartCombatPayload } from '@common/socket-events';
import { OnEvent } from '@nestjs/event-emitter';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/api' })
export class CombatGateway {
  @WebSocketServer() private server: Server;

  constructor(
    private readonly combatService: CombatService, 
    private readonly gameSessionService: GameSessionService){}

  handleDisconnect(client: Socket): void {
    const rooms = Array.from(client.rooms);
    const combatId = this.combatService.getCombatIdByRooms(rooms);
    if(combatId)
      client.leave(combatId);
  }

  @SubscribeMessage(CombatSocketEvents.StartTempCombat)
  startCombat(@ConnectedSocket() client: Socket, @MessageBody() payload: StartCombatPayload): void {
    if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
        client.emit(CombatSocketEvents.CombatSessionError, { message: 'Combat refusé.' } satisfies GameSessionErrorPayload);
        return;
    }
    const opponentSocket = this.getOpponentSocket(payload.sessionId, payload.defenderId);
    if(!opponentSocket){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Adversaire indisponible.' } satisfies GameSessionErrorPayload);
      return;
    }
    const session = this.combatService.createCombatSession(payload.playerId, payload.defenderId, payload.sessionId);
    if(!session){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Combat impossible.' } satisfies GameSessionErrorPayload);
      return;
    }
    opponentSocket.join(session.id);
    client.join(session.id);
    this.combatService.startCombat(session);
  }

  @SubscribeMessage(CombatSocketEvents.SetStance)
  setCombatStance(@ConnectedSocket() client: Socket, @MessageBody() payload: StancePayload): void {
    if(!this.combatService.combatTurn(payload.combatId, payload.playerId, payload.stance)){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Joueur interdit.' } satisfies GameSessionErrorPayload);
      return;
    }
  }

  @OnEvent(CombatEvents.Turn)
  handleTurnSwitch(payload: CombatTurnSnapshot): void {
    if(payload.combatId)
      this.server.to(payload.combatId).emit(CombatSocketEvents.TurnSnapshot, payload.turnState);
  }

  @OnEvent(CombatEvents.Statistics)
  handleCombatStatistics(payload: CombatSessionSnapshot): void {
    if(payload.combatId)
      this.server.to(payload.combatId).emit(CombatSocketEvents.AttackSnapshot, payload.statistics);
  }

  @OnEvent(CombatEvents.Victory)
  handleVictory(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { winner: payload.winner, loser: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.Victory, newPayload);
      this.server.to(payload.gameSessionId).emit(SessionSocketEvents.CombatVictory, newPayload);
    }
  }

  @OnEvent(CombatEvents.Tie)
  handleTie(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { player1: payload.winner, player2: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.Tie, newPayload);
      this.server.to(payload.gameSessionId).emit(SessionSocketEvents.CombatTie, newPayload);
    }
  }

  @OnEvent(CombatEvents.ClientDisconnect)
  handleOpponentDisconnect(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { winner: payload.winner, loser: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.Disconnect, newPayload);
      const socket = this.getOpponentSocket(payload.gameSessionId, payload.winner);
      if(socket)
        socket.leave(payload.combatId);
    }
  }

  private getOpponentSocket(gameSessionId: string, opponentId: string): Socket | undefined {
    const opponentSocketId = this.gameSessionService.getSocketFromPlayer(gameSessionId, opponentId);
    if(!opponentSocketId){
      return undefined;
    }
    return this.server.sockets.sockets.get(opponentSocketId);
  }
}
