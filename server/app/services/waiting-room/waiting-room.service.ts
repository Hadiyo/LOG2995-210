import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { MapService } from '@app/services/map/map.service';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { MapSize } from '@common/maps/map.enums';
import {
    AddWaitingRoomVirtualPlayerPayload,
    CreateWaitingRoomPayload,
    JoinWaitingRoomPayload,
    KickWaitingRoomPlayerPayload,
    SendWaitingRoomMessagePayload,
    WaitingRoomEvents,
    WaitingRoomStatePayload,
} from '@common/socket-events';
import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
    buildWaitingRoomVirtualPlayer,
    findWaitingRoomAccessCode,
    resolveUniqueWaitingRoomPlayerName,
} from './waiting-room-player.utils';
import { createWaitingRoomPreview } from './waiting-room-preview';
import {
    ACCESS_CODE_CHARS,
    ACCESS_CODE_LENGTH,
    CHAT_MESSAGE_MAX_LENGTH,
    MAX_PLAYERS_BY_MAP_SIZE,
    MIN_PLAYERS_TO_START,
} from './waiting-room.constants';
import {
    WaitingRoom,
    WaitingRoomCancelledEvent,
    WaitingRoomDirectoryUpdatedEvent,
    WaitingRoomErrorEvent,
    WaitingRoomGameStartedEvent,
    WaitingRoomMessageSentEvent,
    WaitingRoomPlayerKickedEvent,
    WaitingRoomUpdatedEvent,
} from './waiting-room.types';

@Injectable()
export class WaitingRoomService {
    private readonly rooms = new Map<string, WaitingRoom>();
    private readonly events = new EventEmitter();

    constructor(
        private readonly mapService: MapService,
        private readonly gameSessionService: GameSessionService,
        private readonly chatService: ChatService,
    ) {}

    on<T>(event: WaitingRoomEvents, callback: (payload: T) => void): void {
        this.events.on(event, callback);
    }

    off<T>(event: WaitingRoomEvents, callback: (payload: T) => void): void {
        this.events.off(event, callback);
    }

    async getAvailableWaitingRoomPreviews(): Promise<WaitingRoomPreview[]> {
        const roomEntries = [...this.rooms.values()].filter((room) => !room.isStarting && !room.isLocked && room.players.length < room.maxPlayers);
        if (roomEntries.length === 0) {
            return [];
        }

        const maps = await this.mapService.getAllMapsSummary();
        const mapsById = new Map(maps.map((map) => [map.id, map]));
        const previews: WaitingRoomPreview[] = [];
        for (const room of roomEntries) {
            const map = mapsById.get(room.mapId);
            if (!map) {
                continue;
            }
            previews.push(createWaitingRoomPreview(room, map));
        }

        return previews;
    }

    getWaitingRoomState(accessCode: string): WaitingRoomStatePayload | null {
        const room = this.rooms.get(accessCode);
        if (!room) {
            return null;
        }

        return {
            accessCode: room.accessCode,
            mapId: room.mapId,
            players: room.players,
            messages: room.messages,
            isLocked: room.isLocked,
            maxPlayers: room.maxPlayers,
            minPlayersToStart: MIN_PLAYERS_TO_START,
        };
    }

    async createWaitingRoom(socketId: string, payload: CreateWaitingRoomPayload): Promise<string> {
        const map = await this.mapService.getMapById(payload.mapId);
        this.leaveExistingWaitingRoom(socketId);
        const maxPlayers = this.resolveMaxPlayers(map.size);
        const accessCode = this.generateAccessCode();

        const organizer: MatchLobbyPlayer = {
            ...payload.player,
            isOrganizer: true,
            controller: 'human',
        };

        const room: WaitingRoom = {
            accessCode,
            mapId: payload.mapId,
            organizerSocketId: socketId,
            players: [organizer],
            messages: [],
            socketToPlayerId: new Map([[socketId, organizer.id]]),
            isLocked: false,
            isStarting: false,
            maxPlayers,
        };

        this.rooms.set(accessCode, room);
        this.emitWaitingRoomUpdated(room);
        this.emitDirectoryUpdated();
        return accessCode;
    }

    joinWaitingRoom(socketId: string, payload: JoinWaitingRoomPayload): boolean {
        const room = this.rooms.get(payload.accessCode);
        if (!room) {
            this.emitError(socketId, 'Partie introuvable.');
            return false;
        }

        if (room.isStarting || room.isLocked || room.players.length >= room.maxPlayers) {
            this.emitError(socketId, 'La salle est verrouillee ou complete.');
            return false;
        }

        if (room.players.some((existingPlayer) => existingPlayer.avatarId === payload.player.avatarId)) {
            this.emitError(socketId, 'Cet avatar est deja utilise dans cette partie.');
            return false;
        }

        this.leaveExistingWaitingRoom(socketId, payload.accessCode);

        const player: MatchLobbyPlayer = {
            ...payload.player,
            name: resolveUniqueWaitingRoomPlayerName(payload.player.name, room),
            isOrganizer: false,
            controller: 'human',
        };

        room.players.push(player);
        room.socketToPlayerId.set(socketId, player.id);
        this.updateLockState(room);
        this.emitWaitingRoomUpdated(room);
        this.emitDirectoryUpdated();
        return true;
    }

    addVirtualPlayer(organizerSocketId: string, payload: AddWaitingRoomVirtualPlayerPayload): void {
        const room = this.rooms.get(payload.accessCode);
        if (!room) {
            this.emitError(organizerSocketId, 'Salle introuvable.');
            return;
        }

        if (room.organizerSocketId !== organizerSocketId) {
            this.emitError(organizerSocketId, 'Seul l organisateur peut ajouter des joueurs virtuels.');
            return;
        }

        if (room.isStarting || room.isLocked || room.players.length >= room.maxPlayers) {
            this.emitError(organizerSocketId, 'La salle est verrouillee ou complete.');
            return;
        }

        room.players.push(buildWaitingRoomVirtualPlayer(room, payload.profile));
        this.updateLockState(room);
        this.emitWaitingRoomUpdated(room);
        this.emitDirectoryUpdated();
    }

    addMessage(socketId: string, payload: SendWaitingRoomMessagePayload): void {
        const room = this.rooms.get(payload.accessCode);
        if (!room) {
            this.emitError(socketId, 'Salle introuvable.');
            return;
        }

        const playerId = room.socketToPlayerId.get(socketId);
        const author = room.players.find((player) => player.id === playerId)?.name;
        if (!author) {
            this.emitError(socketId, 'Auteur introuvable pour ce message.');
            return;
        }

        const message = this.chatService.createMessage(author, payload.content, CHAT_MESSAGE_MAX_LENGTH);
        if (!message) {
            return;
        }

        room.messages.push(message);
        this.events.emit(WaitingRoomEvents.WaitingRoomMessageSent, {
            accessCode: room.accessCode,
            payload: message,
        } as WaitingRoomMessageSentEvent);
    }

    leaveWaitingRoom(socketId: string, accessCode: string): void {
        const room = this.rooms.get(accessCode);
        if (!room) {
            return;
        }

        if (socketId === room.organizerSocketId) {
            this.rooms.delete(accessCode);
            this.events.emit(WaitingRoomEvents.WaitingRoomCancelled, { accessCode } as WaitingRoomCancelledEvent);
            this.emitDirectoryUpdated();
            return;
        }

        this.removePlayerBySocket(room, socketId);
        this.updateLockState(room);
        this.emitWaitingRoomUpdated(room);
        this.emitDirectoryUpdated();
    }

    kickPlayer(organizerSocketId: string, payload: KickWaitingRoomPlayerPayload): void {
        const room = this.rooms.get(payload.accessCode);
        if (!room) {
            return;
        }

        if (room.organizerSocketId !== organizerSocketId) {
            this.emitError(organizerSocketId, 'Seul l organisateur peut exclure des joueurs.');
            return;
        }

        const organizerId = room.socketToPlayerId.get(room.organizerSocketId);
        if (payload.playerId === organizerId) {
            this.emitError(organizerSocketId, 'L organisateur ne peut pas etre exclu.');
            return;
        }

        const kickedSocketId = [...room.socketToPlayerId.entries()]
            .find(([, playerId]) => playerId === payload.playerId)?.[0];

        room.players = room.players.filter((player) => player.id !== payload.playerId);
        if (kickedSocketId) {
            room.socketToPlayerId.delete(kickedSocketId);
            this.events.emit(WaitingRoomEvents.WaitingRoomPlayerKicked, {
                accessCode: payload.accessCode,
                kickedSocketId,
            } as WaitingRoomPlayerKickedEvent);
        }

        this.updateLockState(room);
        this.emitWaitingRoomUpdated(room);
        this.emitDirectoryUpdated();
    }

    async startGame(organizerSocketId: string, accessCode: string): Promise<void> {
        const room = this.rooms.get(accessCode);
        if (!room) {
            return;
        }

        if (room.organizerSocketId !== organizerSocketId) {
            this.emitError(organizerSocketId, 'Seul l organisateur peut lancer la partie.');
            return;
        }

        if (room.players.length < MIN_PLAYERS_TO_START) {
            this.emitError(organizerSocketId, 'Il faut au moins 2 joueurs pour demarrer.');
            return;
        }

        if (room.isStarting) {
            return;
        }

        room.isStarting = true;
        this.updateLockState(room);
        this.emitWaitingRoomUpdated(room);
        this.emitDirectoryUpdated();
        try {
            const sessionId = await this.gameSessionService.createSessionFromWaitingRoom(room.mapId, room.players, room.messages);
            if (this.rooms.get(accessCode) !== room || room.players.length < MIN_PLAYERS_TO_START) {
                room.isStarting = false;
                this.updateLockState(room);
                this.gameSessionService.destroySession(sessionId);
                if (this.rooms.get(accessCode) === room) {
                    this.emitWaitingRoomUpdated(room);
                    this.emitDirectoryUpdated();
                }
                return;
            }

            this.rooms.delete(accessCode);
            this.events.emit(WaitingRoomEvents.WaitingRoomGameStarted, {
                accessCode,
                sessionId,
                messages: room.messages,
            } as WaitingRoomGameStartedEvent);
            this.emitDirectoryUpdated();
        } catch (error) {
            room.isStarting = false;
            this.updateLockState(room);
            this.emitWaitingRoomUpdated(room);
            this.emitDirectoryUpdated();
            throw error;
        }
    }

    handleDisconnect(socketId: string): void {
        const accessCode = this.getAccessCodeForSocket(socketId);
        if (accessCode) {
            this.leaveWaitingRoom(socketId, accessCode);
        }
    }

    getAccessCodeForSocket(socketId: string): string | undefined {
        return findWaitingRoomAccessCode(this.rooms.values(), socketId);
    }

    private emitWaitingRoomUpdated(room: WaitingRoom): void {
        const payload = this.getWaitingRoomState(room.accessCode);
        if (!payload) {
            return;
        }

        this.events.emit(WaitingRoomEvents.WaitingRoomUpdated, {
            accessCode: room.accessCode,
            payload,
        } as WaitingRoomUpdatedEvent);
    }

    private emitError(socketId: string, message: string): void {
        this.events.emit(WaitingRoomEvents.WaitingRoomError, {
            socketId,
            payload: { message },
        } as WaitingRoomErrorEvent);
    }

    private emitDirectoryUpdated(): void {
        this.events.emit(WaitingRoomEvents.WaitingRoomDirectoryUpdated, {
            updatedAt: new Date().toISOString(),
        } as WaitingRoomDirectoryUpdatedEvent);
    }

    private removePlayerBySocket(room: WaitingRoom, socketId: string): void {
        const playerId = room.socketToPlayerId.get(socketId);
        if (!playerId) {
            return;
        }

        room.socketToPlayerId.delete(socketId);
        const playerStillConnected = [...room.socketToPlayerId.values()].some((connectedPlayerId) => connectedPlayerId === playerId);
        if (playerStillConnected) {
            return;
        }

        room.players = room.players.filter((player) => player.id !== playerId);
    }

    private updateLockState(room: WaitingRoom): void {
        room.isLocked = room.isStarting || room.players.length >= room.maxPlayers;
    }

    private leaveExistingWaitingRoom(socketId: string, nextAccessCode?: string): void {
        const currentAccessCode = this.getAccessCodeForSocket(socketId);
        if (!currentAccessCode || currentAccessCode === nextAccessCode) {
            return;
        }

        this.leaveWaitingRoom(socketId, currentAccessCode);
    }

    private resolveMaxPlayers(size: MapSize): number {
        return MAX_PLAYERS_BY_MAP_SIZE[size] ?? MAX_PLAYERS_BY_MAP_SIZE[MapSize.S];
    }

    private generateAccessCode(): string {
        let code = '';
        do {
            code = Array.from({ length: ACCESS_CODE_LENGTH }, () =>
                ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)],
            ).join('');
        } while (this.rooms.has(code));
        return code;
    }
}
