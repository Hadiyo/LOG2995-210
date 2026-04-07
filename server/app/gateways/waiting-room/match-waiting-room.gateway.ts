import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import {
    WaitingRoomCancelledEvent,
    WaitingRoomErrorEvent,
    WaitingRoomGameStartedEvent,
    WaitingRoomMessageSentEvent,
    WaitingRoomPlayerKickedEvent,
    WaitingRoomUpdatedEvent,
} from '@app/services/waiting-room/waiting-room.types';
import {
    CreateWaitingRoomPayload,
    getWaitingRoomRoom,
    JoinWaitingRoomPayload,
    KickWaitingRoomPlayerPayload,
    SendWaitingRoomMessagePayload,
    WaitingRoomEvents,
} from '@common/socket-events';
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

@WebSocketGateway({ namespace: '/api' })
export class MatchWaitingRoomGateway implements OnGatewayDisconnect, OnModuleDestroy {
    @WebSocketServer() private server: Server;

    private onUpdated!: (event: WaitingRoomUpdatedEvent) => void;
    private onMessage!: (event: WaitingRoomMessageSentEvent) => void;
    private onError!: (event: WaitingRoomErrorEvent) => void;
    private onKicked!: (event: WaitingRoomPlayerKickedEvent) => void;
    private onCancelled!: (event: WaitingRoomCancelledEvent) => void;
    private onStarted!: (event: WaitingRoomGameStartedEvent) => void;
    private onDirectoryUpdated!: () => void;

    constructor(
        private readonly waitingRoomService: WaitingRoomService,
        private readonly logger: Logger = new Logger(MatchWaitingRoomGateway.name),
    ) {
        this.subscribeToWaitingRoomEvents();
    }

    onModuleDestroy(): void {
        this.unsubscribeFromWaitingRoomEvents();
    }

    handleDisconnect(client: Socket): void {
        this.waitingRoomService.handleDisconnect(client.id);
    }

    @SubscribeMessage(WaitingRoomEvents.CreateWaitingRoom)
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
                client.emit(WaitingRoomEvents.WaitingRoomUpdated, state);
            }
        } catch (error) {
            this.logger.error(`Impossible de creer la salle: ${error}`);
            client.emit(WaitingRoomEvents.WaitingRoomError, { message: 'Impossible de creer la salle d attente.' });
        }
    }

    @SubscribeMessage(WaitingRoomEvents.JoinWaitingRoom)
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
            client.emit(WaitingRoomEvents.WaitingRoomUpdated, state);
        }
    }

    @SubscribeMessage(WaitingRoomEvents.LeaveWaitingRoom)
    leaveWaitingRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { accessCode: string },
    ): void {
        this.waitingRoomService.leaveWaitingRoom(client.id, payload.accessCode);
        client.leave(getWaitingRoomRoom(payload.accessCode));
    }

    @SubscribeMessage(WaitingRoomEvents.KickWaitingRoomPlayer)
    kickPlayer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: KickWaitingRoomPlayerPayload,
    ): void {
        this.waitingRoomService.kickPlayer(client.id, payload);
    }

    @SubscribeMessage(WaitingRoomEvents.SendWaitingRoomMessage)
    sendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SendWaitingRoomMessagePayload,
    ): void {
        this.waitingRoomService.addMessage(client.id, payload);
    }

    @SubscribeMessage(WaitingRoomEvents.StartWaitingRoomGame)
    async startGame(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { accessCode: string },
    ): Promise<void> {
        try {
            await this.waitingRoomService.startGame(client.id, payload.accessCode);
        } catch (error) {
            this.logger.error(`Impossible de lancer la partie: ${error}`);
            client.emit(WaitingRoomEvents.WaitingRoomError, { message: 'Impossible de lancer la partie.' });
        }
    }

    private subscribeToWaitingRoomEvents(): void {
        this.subscribeUpdatedEvent();
        this.subscribeMessageEvent();
        this.subscribeErrorEvent();
        this.subscribeKickedEvent();
        this.subscribeCancelledEvent();
        this.subscribeStartedEvent();
        this.subscribeDirectoryUpdatedEvent();
    }

    private unsubscribeFromWaitingRoomEvents(): void {
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomUpdated, this.onUpdated);
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomMessageSent, this.onMessage);
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomError, this.onError);
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomPlayerKicked, this.onKicked);
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomCancelled, this.onCancelled);
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomGameStarted, this.onStarted);
        this.waitingRoomService.off(WaitingRoomEvents.WaitingRoomDirectoryUpdated, this.onDirectoryUpdated);
    }

    private subscribeUpdatedEvent(): void {
        this.onUpdated = (event) => {
            this.server.to(getWaitingRoomRoom(event.accessCode)).emit(WaitingRoomEvents.WaitingRoomUpdated, event.payload);
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomUpdated, this.onUpdated);
    }

    private subscribeMessageEvent(): void {
        this.onMessage = (event) => {
            this.server.to(getWaitingRoomRoom(event.accessCode)).emit(WaitingRoomEvents.WaitingRoomMessageSent, event.payload);
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomMessageSent, this.onMessage);
    }

    private subscribeErrorEvent(): void {
        this.onError = (event) => {
            this.server.to(event.socketId).emit(WaitingRoomEvents.WaitingRoomError, event.payload);
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomError, this.onError);
    }

    private subscribeKickedEvent(): void {
        this.onKicked = (event) => {
            const room = getWaitingRoomRoom(event.accessCode);
            this.server.in(event.kickedSocketId).socketsLeave(room);
            this.server.to(event.kickedSocketId).emit(WaitingRoomEvents.WaitingRoomPlayerKicked, {
                message: 'Vous avez ete exclu de la salle d attente par l organisateur.',
            });
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomPlayerKicked, this.onKicked);
    }

    private subscribeCancelledEvent(): void {
        this.onCancelled = (event) => {
            const room = getWaitingRoomRoom(event.accessCode);
            this.server.to(room).emit(WaitingRoomEvents.WaitingRoomCancelled, {
                message: 'La salle d attente a ete fermee.',
            });
            this.server.in(room).socketsLeave(room);
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomCancelled, this.onCancelled);
    }

    private subscribeStartedEvent(): void {
        this.onStarted = (event) => {
            const room = getWaitingRoomRoom(event.accessCode);
            this.server.to(room).emit(WaitingRoomEvents.WaitingRoomGameStarted, {
                accessCode: event.accessCode,
                sessionId: event.sessionId,
                messages: event.messages,
            });
            this.server.in(room).socketsLeave(room);
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomGameStarted, this.onStarted);
    }

    private subscribeDirectoryUpdatedEvent(): void {
        this.onDirectoryUpdated = () => {
            this.server.emit(WaitingRoomEvents.WaitingRoomDirectoryUpdated);
        };
        this.waitingRoomService.on(WaitingRoomEvents.WaitingRoomDirectoryUpdated, this.onDirectoryUpdated);
    }
}
