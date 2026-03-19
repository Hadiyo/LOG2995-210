import { GameSessionService } from '@app/services/game-session/game-session.service';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
    EndGameTurnPayload,
    GameSessionErrorPayload,
    GameSessionSnapshotPayload,
    getGameSessionRoom,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    SocketEvents,
    StartCombatPayload,
    ToggleDoorPayload,
    SurrenderGamePayload,
} from '@common/socket-events';

@WebSocketGateway({ namespace: '/api' })
export class GameSessionGateway implements OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer() private server: Server;

    private onSnapshot!: (payload: GameSessionSnapshotPayload) => void;

    constructor(
        private readonly gameSessionService: GameSessionService,
        private readonly logger: Logger = new Logger(GameSessionGateway.name),
    ) {
        this.onSnapshot = (payload) => {
            this.server.to(getGameSessionRoom(payload.sessionId)).emit(SocketEvents.GameSessionSnapshot, payload);
        };
        this.gameSessionService.on(SocketEvents.GameSessionSnapshot, this.onSnapshot);
    }

    onModuleDestroy(): void {
        this.gameSessionService.off(SocketEvents.GameSessionSnapshot, this.onSnapshot);
    }

    handleDisconnect(client: Socket): void {
        this.logger.log(`Client ${client.id} disconnected.`);
        const membership = this.gameSessionService.removeSocket(client.id);
        if (membership) {
            this.gameSessionService.surrender(membership.sessionId, membership.playerId);
        }
    }

    @SubscribeMessage(SocketEvents.JoinGameSession)
    joinSession(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinGameSessionPayload,
    ): void {
        try {
            const snapshot = this.gameSessionService.registerSocket(payload.sessionId, payload.playerId, client.id);
            client.join(getGameSessionRoom(payload.sessionId));
            client.emit(SocketEvents.GameSessionSnapshot, {
                sessionId: payload.sessionId,
                match: snapshot.match,
                turnState: snapshot.turnState,
            } satisfies GameSessionSnapshotPayload);
        } catch {
            client.emit(SocketEvents.GameSessionError, {
                message: 'Impossible de joindre la session de jeu.',
            } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SocketEvents.MoveGamePlayer)
    movePlayer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: MoveGamePlayerPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SocketEvents.GameSessionError, { message: 'Deplacement refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.movePlayer(payload.sessionId, payload.playerId, payload.direction)) {
            client.emit(SocketEvents.GameSessionError, { message: 'Deplacement refuse.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SocketEvents.EndGameTurn)
    endTurn(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: EndGameTurnPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SocketEvents.GameSessionError, { message: 'Fin de tour refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.endTurn(payload.sessionId, payload.playerId)) {
            client.emit(SocketEvents.GameSessionError, { message: 'Fin de tour refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SocketEvents.StartCombat)
    startCombat(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: StartCombatPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SocketEvents.GameSessionError, { message: 'Combat refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.startCombat(payload.sessionId, payload.playerId, payload.defenderId)) {
            client.emit(SocketEvents.GameSessionError, { message: 'Combat refuse.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SocketEvents.ToggleDoor)
    toggleDoor(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: ToggleDoorPayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SocketEvents.GameSessionError, { message: 'Action de porte refusee.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.toggleDoor(payload.sessionId, payload.playerId, payload.position)) {
            client.emit(SocketEvents.GameSessionError, { message: 'Action de porte refusee.' } satisfies GameSessionErrorPayload);
        }
    }

    @SubscribeMessage(SocketEvents.SurrenderGame)
    surrender(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SurrenderGamePayload,
    ): void {
        if (this.gameSessionService.getPlayerIdForSocket(client.id, payload.sessionId) !== payload.playerId) {
            client.emit(SocketEvents.GameSessionError, { message: 'Abandon refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        if (!this.gameSessionService.surrender(payload.sessionId, payload.playerId)) {
            client.emit(SocketEvents.GameSessionError, { message: 'Abandon refuse.' } satisfies GameSessionErrorPayload);
            return;
        }

        client.leave(getGameSessionRoom(payload.sessionId));
    }
}
