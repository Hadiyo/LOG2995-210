import { CombatService } from '@app/services/combat/combat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { MILLISECONDS_PER_SECOND } from '@app/utilities/combat/combat.constants';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import {
  CombatResultSnapshot,
  CombatSessionSnapshot,
  CombatTurnSnapshot,
  CombatWaitingSnapshot,
  StancePayload,
} from '@common/combat/combat.interface';
import { CombatSocketEvents, GameSessionErrorPayload, getGameSessionRoom, SessionSocketEvents, StartCombatPayload } from '@common/socket-events';
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

  @SubscribeMessage(CombatSocketEvents.StartCombat)
  async startCombat(@ConnectedSocket() client: Socket, @MessageBody() payload: StartCombatPayload): Promise<void> {
    if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
        client.emit(CombatSocketEvents.CombatSessionError, { message: 'Combat refusé.' } satisfies GameSessionErrorPayload);
        return;
    }
    const opponentSocket = this.getOpponentSocket(payload.sessionId, payload.defenderId);
    if(!opponentSocket){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Adversaire indisponible.' } satisfies GameSessionErrorPayload);
      return;
    }
    const result = this.combatService.createCombatSession(payload.playerId, payload.defenderId, payload.sessionId);
    if(!result){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Combat impossible.' } satisfies GameSessionErrorPayload);
      return;
    }

    await Promise.all([
      Promise.resolve(opponentSocket.join(result.combat.id)),
      Promise.resolve(client.join(result.combat.id)),
    ]);
    this.gameSessionService.stopSessionTimers(result.game);
    this.combatService.startCombat(result.combat);
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
    if(payload.gameSessionId){
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.CombatWaitingSnapshot, this.createWaitingSnapshot(payload));
    }
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
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.CombatVictory, newPayload);
    }
  }

  @OnEvent(CombatEvents.Tie)
  handleTie(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { player1: payload.winner, player2: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.Tie, newPayload);
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.CombatTie, newPayload);
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
    return this.getSocketRegistry().get(opponentSocketId);
  }

  private getSocketRegistry(): Map<string, Socket> {
    const serverWithRegistry = this.server as unknown as {
      sockets?: Map<string, Socket> | { sockets?: Map<string, Socket> };
    };

    const registry = serverWithRegistry.sockets;
    if (registry instanceof Map) {
      return registry;
    }
    return registry?.sockets ?? new Map<string, Socket>();
  }

  private createWaitingSnapshot(payload: CombatTurnSnapshot): CombatWaitingSnapshot {
    const remainingMs = payload.turnState.phase === 'active'
      ? payload.turnState.activeTurnRemainingMs
      : payload.turnState.transitionRemainingMs;
    return {
      combatId: payload.combatId,
      gameSessionId: payload.gameSessionId,
      attackerId: payload.attackerId,
      defenderId: payload.defenderId,
      activePlayerId: payload.turnState.activePlayerId,
      phase: payload.turnState.phase,
      round: payload.round,
      countdownSeconds: Math.max(0, Math.ceil(remainingMs / MILLISECONDS_PER_SECOND)),
    };
  }
}
