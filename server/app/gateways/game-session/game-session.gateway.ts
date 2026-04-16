import { CombatService } from '@app/services/combat/combat.service';
import { EndStatsService } from '@app/services/end-stats.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameSessionEvents } from '@app/utilities/combat/combat.enums';
import {
    CombatSocketEvents,
    DebugTeleportPlayerPayload,
    EndGameTurnPayload,
    ForceEndDebugTurnPayload,
    GameSessionErrorPayload,
    GameSessionSnapshotPayload,
    getGameSessionRoom,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    RequestFlagTransferPayload,
    ResolveFlagTransferPayload,
    ResolveSanctuaryChoicePayload,
    SessionSocketEvents,
    SurrenderGamePayload,
    ToggleDebugModePayload,
    ToggleDoorPayload,
    UseSanctuaryPayload,
} from '@common/socket-events';
import { OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/api' })
export class GameSessionGateway implements OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer() private server: Server;

    private onSnapshot!: (payload: GameSessionSnapshotPayload) => void;
    private onEndGame!: (sessionId: string) => void;

    constructor(
        private readonly gameSessionService: GameSessionService,
        private readonly endStatsService: EndStatsService,
        private readonly combatSession: CombatService,
    ) {
        this.onSnapshot = (payload) => {
            for (const socketId of this.gameSessionService.getSocketIdsForSession(payload.sessionId)) {
                const snapshot = this.gameSessionService.getSnapshotForSocket(payload.sessionId, socketId);
                if (snapshot) {
                    this.server.to(socketId).emit(SessionSocketEvents.GameSessionSnapshot, snapshot);
                }
            }
        };
        this.gameSessionService.on(SessionSocketEvents.GameSessionSnapshot, this.onSnapshot);

        this.onEndGame = (sessionId) => {
            this.server.to(getGameSessionRoom(sessionId)).emit(SessionSocketEvents.EndGame, this.endStatsService.endGame(sessionId));
        };
        this.gameSessionService.on(SessionSocketEvents.EndGame, this.onEndGame);
    }

    onModuleDestroy(): void {
        this.gameSessionService.off(SessionSocketEvents.GameSessionSnapshot, this.onSnapshot);
        this.gameSessionService.off(SessionSocketEvents.EndGame, this.onEndGame);
    }

    handleDisconnect(client: Socket): void {
        const membership = this.gameSessionService.removeSocket(client.id);
        if (membership) {
            this.combatSession.handleDisconnect(membership.playerId);
            this.gameSessionService.surrender(membership.sessionId, membership.playerId);
        }
    }

    @OnEvent(GameSessionEvents.OnGameEnd)
    onGameSessionEnd(id: string): void {
        this.server.in(id).socketsLeave(id);
    }

    @SubscribeMessage(SessionSocketEvents.JoinGameSession)
    joinSession(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinGameSessionPayload,
    ): void {
        try {
            const snapshot = this.gameSessionService.registerSocket(payload.sessionId, payload.playerId, client.id);
            if (snapshot.previousSessionId) {
                client.leave(getGameSessionRoom(snapshot.previousSessionId));
            }
            client.join(getGameSessionRoom(payload.sessionId));
            client.emit(SessionSocketEvents.GameSessionSnapshot, {
                ...snapshot.snapshot,
            } satisfies GameSessionSnapshotPayload);
        } catch {
            client.emit(SessionSocketEvents.GameSessionError, {
                message: 'Impossible de joindre la session de jeu.',
            } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SessionSocketEvents.ToggleDebugMode)
    toggleDebugMode(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ToggleDebugModePayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Mode debug refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.toggleDebugMode(payload.sessionId, payload.playerId)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Mode debug refuse.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SessionSocketEvents.ForceEndDebugTurn)
    forceEndDebugTurn(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ForceEndDebugTurnPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Fin de tour debug refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.forceEndDebugTurn(payload.sessionId, payload.playerId)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Fin de tour debug refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SessionSocketEvents.DebugTeleportPlayer)
    debugTeleportPlayer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: DebugTeleportPlayerPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Teleportation debug refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.debugTeleportPlayer(payload.sessionId, payload.playerId, payload.position)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Teleportation debug refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.MoveGamePlayer)
    movePlayer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: MoveGamePlayerPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Deplacement refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.movePlayer(payload.sessionId, payload.playerId, payload.direction)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Deplacement refuse.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.EndGameTurn)
    endTurn(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: EndGameTurnPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Fin de tour refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.endTurn(payload.sessionId, payload.playerId)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Fin de tour refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.UseSanctuary)
    useSanctuary(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: UseSanctuaryPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Action de sanctuaire refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.useSanctuary(payload.sessionId, payload.playerId, payload.sanctuaryId)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Action de sanctuaire refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.ResolveSanctuaryChoice)
    resolveSanctuaryChoice(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ResolveSanctuaryChoicePayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Choix de sanctuaire refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.resolveSanctuaryChoice(payload.sessionId, payload.playerId, payload.choice)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Choix de sanctuaire refuse.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.ToggleDoor)
    toggleDoor(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ToggleDoorPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Action de porte refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.toggleDoor(payload.sessionId, payload.playerId, payload.position)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Action de porte refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.RequestFlagTransfer)
    requestFlagTransfer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: RequestFlagTransferPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Transfert du drapeau refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.requestFlagTransfer(payload.sessionId, payload.playerId, payload.teammateId)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Transfert du drapeau refuse.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(CombatSocketEvents.ResolveFlagTransfer)
    resolveFlagTransfer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ResolveFlagTransferPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Reponse de transfert refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.resolveFlagTransfer(payload.sessionId, payload.playerId, payload.accepted)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Reponse de transfert refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SessionSocketEvents.SurrenderGame)
    surrender(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SurrenderGamePayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Abandon refuse.' } satisfies GameSessionErrorPayload);
            return;
        }
        this.combatSession.handleDisconnect(payload.playerId);
        if (!this.gameSessionService.surrender(payload.sessionId, payload.playerId)) {
            client.emit(SessionSocketEvents.GameSessionError, { message: 'Abandon refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        client.leave(getGameSessionRoom(payload.sessionId));
    }
}
