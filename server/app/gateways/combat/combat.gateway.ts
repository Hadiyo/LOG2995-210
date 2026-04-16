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
    private readonly gameSessionService: GameSessionService,
  ){}

  @SubscribeMessage(CombatSocketEvents.StartCombat)
  async startCombat(@ConnectedSocket() client: Socket, @MessageBody() payload: StartCombatPayload): Promise<void> {
    if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
        client.emit(CombatSocketEvents.CombatSessionError, { message: 'Combat refusé.' } satisfies GameSessionErrorPayload);
        return;
    }
    const opponentSocket = this.getOpponentSocket(payload.sessionId, payload.defenderId);
    if(!opponentSocket && !this.isVirtualCombatant(payload.sessionId, payload.defenderId)){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Adversaire indisponible.' } satisfies GameSessionErrorPayload);
      return;
    }
    const result = this.combatService.createCombatSession(payload.playerId, payload.defenderId, payload.sessionId);
    if(!result){
      client.emit(CombatSocketEvents.CombatSessionError, { message: 'Combat impossible.' } satisfies GameSessionErrorPayload);
      return;
    }

    await Promise.all([
      Promise.resolve(client.join(result.combat.id)),
      ...(opponentSocket ? [Promise.resolve(opponentSocket.join(result.combat.id))] : []),
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
    this.emitToCombatParticipants(
      payload.gameSessionId,
      [payload.attackerId, payload.defenderId],
      CombatSocketEvents.TurnSnapshot,
      payload.turnState,
    );
    if(payload.gameSessionId){
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.CombatWaitingSnapshot, this.createWaitingSnapshot(payload));
    }
    this.resolveVirtualCombatTurn(payload);
  }

  @OnEvent(CombatEvents.Statistics)
  handleCombatStatistics(payload: CombatSessionSnapshot): void {
    if(payload.combatId)
      this.server.to(payload.combatId).emit(CombatSocketEvents.AttackSnapshot, payload.statistics);
    const combat = payload.combatId ? this.combatService.getCombatSession(payload.combatId) : undefined;
    if (combat) {
      const participantIds = combat.players.map((player) => player.stats.id);
      this.emitToCombatParticipants(combat.gameSessionId, participantIds, CombatSocketEvents.AttackSnapshot, payload.statistics);
    }
  }

  @OnEvent(CombatEvents.Victory)
  handleVictory(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { winner: payload.winner, loser: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.Victory, newPayload);
      this.emitToCombatParticipants(payload.gameSessionId, [payload.winner, payload.loser], CombatSocketEvents.Victory, newPayload);
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.CombatVictory, newPayload);
      this.server.in(payload.combatId).socketsLeave(payload.combatId);
    }
  }

  @OnEvent(CombatEvents.Tie)
  handleTie(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { player1: payload.winner, player2: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.Tie, newPayload);
      this.emitToCombatParticipants(payload.gameSessionId, [payload.winner, payload.loser], CombatSocketEvents.Tie, newPayload);
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.CombatTie, newPayload);
      this.server.in(payload.combatId).socketsLeave(payload.combatId);
    }
  }

  @OnEvent(CombatEvents.ClientDisconnect)
  handleOpponentDisconnect(payload: CombatResultSnapshot): void {
    if(payload.combatId && payload.gameSessionId){
      const newPayload = { winner: payload.winner, loser: payload.loser };
      this.server.to(payload.combatId).emit(CombatSocketEvents.HandleDisconnect, newPayload);
      this.emitToCombatParticipants(payload.gameSessionId, [payload.winner, payload.loser], CombatSocketEvents.HandleDisconnect, newPayload);
      this.server.to(getGameSessionRoom(payload.gameSessionId)).emit(SessionSocketEvents.ClientDisconnect, newPayload);
      this.server.in(payload.combatId).socketsLeave(payload.combatId);
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

  private isVirtualCombatant(gameSessionId: string, playerId: string): boolean {
    const match = this.gameSessionService.getMatchFromSessionId(gameSessionId);
    return match?.players.find((player) => player.id === playerId)?.controller === 'virtual';
  }

  private resolveVirtualCombatTurn(payload: CombatTurnSnapshot): void {
    if (payload.turnState.phase !== 'active' || !payload.turnState.activePlayerId) {
      return;
    }

    const match = this.gameSessionService.getMatchFromSessionId(payload.gameSessionId);
    const activePlayer = match?.players.find((player) => player.id === payload.turnState.activePlayerId) ?? null;
    if (activePlayer?.controller !== 'virtual') {
      return;
    }

    const stance = activePlayer.virtualProfile === 'defensive' ? 'defense' : 'attack';
    this.combatService.combatTurn(payload.combatId, activePlayer.id, stance);
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

  private emitToCombatParticipants(
    gameSessionId: string | undefined,
    participantIds: (string | undefined)[],
    event: CombatSocketEvents,
    payload:
      | CombatTurnSnapshot['turnState']
      | CombatSessionSnapshot['statistics']
      | { winner: string; loser: string }
      | { player1: string; player2: string },
  ): void {
    if (!gameSessionId) {
      return;
    }

    const socketIds = new Set(
      participantIds
        .map((participantId) => this.gameSessionService.getSocketFromPlayer(gameSessionId, participantId))
        .filter((socketId): socketId is string => !!socketId),
    );

    for (const socketId of socketIds) {
      this.server.to(socketId).emit(event, payload);
    }
  }
}
