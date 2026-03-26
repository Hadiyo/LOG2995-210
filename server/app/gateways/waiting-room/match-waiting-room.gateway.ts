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
    CreateWaitingRoomPayload,
    getWaitingRoomRoom,
    JoinWaitingRoomPayload,
    KickWaitingRoomPlayerPayload,
    SendWaitingRoomMessagePayload,
    SocketEvents,
} from '@common/socket-events';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import {
    WaitingRoomCancelledEvent,
    WaitingRoomErrorEvent,
    WaitingRoomGameStartedEvent,
    WaitingRoomMessageSentEvent,
    WaitingRoomPlayerKickedEvent,
    WaitingRoomUpdatedEvent,
} from '@app/services/waiting-room/waiting-room.types';

@WebSocketGateway({ namespace: '/api' })
export class MatchWaitingRoomGateway implements OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer() private server: Server;

    private readonly onUpdated: (event: WaitingRoomUpdatedEvent) => void;
    private readonly onMessage: (event: WaitingRoomMessageSentEvent) => void;
    private readonly onError: (event: WaitingRoomErrorEvent) => void;
    private readonly onKicked: (event: WaitingRoomPlayerKickedEvent) => void;
    private readonly onCancelled: (event: WaitingRoomCancelledEvent) => void;
    private readonly onStarted: (event: WaitingRoomGameStartedEvent) => void;
    private readonly onDirectoryUpdated: () => void;

    constructor(
        private readonly waitingRoomService: WaitingRoomService,
        private readonly logger: Logger = new Logger(MatchWaitingRoomGateway.name),
    ) {
        this.onUpdated = (event) => {
            this.server.to(getWaitingRoomRoom(event.accessCode)).emit(SocketEvents.WaitingRoomUpdated, event.payload);
        };
        this.onMessage = (event) => {
            this.server.to(getWaitingRoomRoom(event.accessCode)).emit(SocketEvents.WaitingRoomMessageSent, event.payload);
        };
        this.onError = (event) => {
            this.server.to(event.socketId).emit(SocketEvents.WaitingRoomError, event.payload);
        };
        this.onKicked = (event) => {
            const room = getWaitingRoomRoom(event.accessCode);
            this.server.in(event.kickedSocketId).socketsLeave(room);
            this.server.to(event.kickedSocketId).emit(SocketEvents.WaitingRoomPlayerKicked, {
                message: 'Vous avez ete exclu de la salle d attente par l organisateur.',
            });
        };
        this.onCancelled = (event) => {
            const room = getWaitingRoomRoom(event.accessCode);
            this.server.to(room).emit(SocketEvents.WaitingRoomCancelled, {
                message: 'La salle d attente a ete fermee.',
            });
            this.server.in(room).socketsLeave(room);
        };
        this.onStarted = (event) => {
            const room = getWaitingRoomRoom(event.accessCode);
            this.server.to(room).emit(SocketEvents.WaitingRoomGameStarted, {
                accessCode: event.accessCode,
                sessionId: event.sessionId,
                messages: event.messages,
            });
            this.server.in(room).socketsLeave(room);
        };
        this.onDirectoryUpdated = () => {
            this.server.emit(SocketEvents.WaitingRoomDirectoryUpdated);
        };

        this.waitingRoomService.on(SocketEvents.WaitingRoomUpdated, this.onUpdated);
        this.waitingRoomService.on(SocketEvents.WaitingRoomMessageSent, this.onMessage);
        this.waitingRoomService.on(SocketEvents.WaitingRoomError, this.onError);
        this.waitingRoomService.on(SocketEvents.WaitingRoomPlayerKicked, this.onKicked);
        this.waitingRoomService.on(SocketEvents.WaitingRoomCancelled, this.onCancelled);
        this.waitingRoomService.on(SocketEvents.WaitingRoomGameStarted, this.onStarted);
        this.waitingRoomService.on(SocketEvents.WaitingRoomDirectoryUpdated, this.onDirectoryUpdated);
    }

    onModuleDestroy(): void {
        this.waitingRoomService.off(SocketEvents.WaitingRoomUpdated, this.onUpdated);
        this.waitingRoomService.off(SocketEvents.WaitingRoomMessageSent, this.onMessage);
        this.waitingRoomService.off(SocketEvents.WaitingRoomError, this.onError);
        this.waitingRoomService.off(SocketEvents.WaitingRoomPlayerKicked, this.onKicked);
        this.waitingRoomService.off(SocketEvents.WaitingRoomCancelled, this.onCancelled);
        this.waitingRoomService.off(SocketEvents.WaitingRoomGameStarted, this.onStarted);
        this.waitingRoomService.off(SocketEvents.WaitingRoomDirectoryUpdated, this.onDirectoryUpdated);
    }

    handleDisconnect(client: Socket): void {
        this.waitingRoomService.handleDisconnect(client.id);
    }

    @SubscribeMessage(SocketEvents.CreateWaitingRoom)
    async createWaitingRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CreateWaitingRoomPayload,
    ): Promise<void> {
        try {
            const previousAccessCode = this.waitingRoomService.getAccessCodeForSocket(client.id);
            const accessCode = await this.waitingRoomService.createWaitingRoom(client.id, payload);
            if (previousAccessCode && previousAccessCode !== accessCode) {
                client.leave(getWaitingRoomRoom(previousAccessCode));
            }
            client.join(getWaitingRoomRoom(accessCode));
            const state = this.waitingRoomService.getWaitingRoomState(accessCode);
            if (state) {
                client.emit(SocketEvents.WaitingRoomUpdated, state);
            }
        } catch (error) {
            this.logger.error(`Impossible de creer la salle: ${error}`);
            client.emit(SocketEvents.WaitingRoomError, { message: 'Impossible de creer la salle d attente.' });
        }
    }

    @SubscribeMessage(SocketEvents.JoinWaitingRoom)
    joinWaitingRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinWaitingRoomPayload,
    ): void {
        const previousAccessCode = this.waitingRoomService.getAccessCodeForSocket(client.id);
        const joined = this.waitingRoomService.joinWaitingRoom(client.id, payload);
        if (!joined) {
            return;
        }

        if (previousAccessCode && previousAccessCode !== payload.accessCode) {
            client.leave(getWaitingRoomRoom(previousAccessCode));
        }
        client.join(getWaitingRoomRoom(payload.accessCode));
        const state = this.waitingRoomService.getWaitingRoomState(payload.accessCode);
        if (state) {
            client.emit(SocketEvents.WaitingRoomUpdated, state);
        }
    }

    @SubscribeMessage(SocketEvents.LeaveWaitingRoom)
    leaveWaitingRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { accessCode: string },
    ): void {
        this.waitingRoomService.leaveWaitingRoom(client.id, payload.accessCode);
        client.leave(getWaitingRoomRoom(payload.accessCode));
    }

    @SubscribeMessage(SocketEvents.KickWaitingRoomPlayer)
    kickPlayer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: KickWaitingRoomPlayerPayload,
    ): void {
        this.waitingRoomService.kickPlayer(client.id, payload);
    }

    @SubscribeMessage(SocketEvents.SendWaitingRoomMessage)
    sendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SendWaitingRoomMessagePayload,
    ): void {
        this.waitingRoomService.addMessage(client.id, payload);
    }

    @SubscribeMessage(SocketEvents.StartWaitingRoomGame)
    async startGame(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { accessCode: string },
    ): Promise<void> {
        try {
            await this.waitingRoomService.startGame(client.id, payload.accessCode);
        } catch (error) {
            this.logger.error(`Impossible de lancer la partie: ${error}`);
            client.emit(SocketEvents.WaitingRoomError, { message: 'Impossible de lancer la partie.' });
        }
    }
}
