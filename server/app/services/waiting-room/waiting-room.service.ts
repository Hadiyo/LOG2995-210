import { GameSessionService } from '@app/services/game-session/game-session.service';
import { MapService } from '@app/services/map/map.service';
import { Injectable } from '@nestjs/common';
import { ChatMessage } from '@common/chat/chat.interface';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { MapSize } from '@common/maps/map.enums';
import {
    CreateWaitingRoomPayload,
    JoinWaitingRoomPayload,
    KickWaitingRoomPlayerPayload,
    SendWaitingRoomMessagePayload,
    SocketEvents,
    WaitingRoomStatePayload,
} from '@common/socket-events';
import { EventEmitter } from 'events';
import {
    ACCESS_CODE_CHARS,
    ACCESS_CODE_LENGTH,
    CHAT_MESSAGE_MAX_LENGTH,
    MAX_PLAYERS_BY_MAP_SIZE,
    MIN_PLAYERS_TO_START,
} from './waiting-room.constants';
import {
    findWaitingRoomAccessCode,
    resolveUniqueWaitingRoomPlayerName,
} from './waiting-room-player.utils';
import { createWaitingRoomPreview } from './waiting-room-preview';
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
    ) {}

    on<T>(event: SocketEvents, callback: (payload: T) => void): void {
        this.events.on(event, callback);
    }

    off<T>(event: SocketEvents, callback: (payload: T) => void): void {
        this.events.off(event, callback);
    }

    async getAvailableWaitingRoomPreviews(): Promise<WaitingRoomPreview[]> {
        const roomEntries = [...this.rooms.values()].filter((room) => !room.isLocked && room.players.length < room.maxPlayers);
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

        if (room.isLocked || room.players.length >= room.maxPlayers) {
            this.emitError(socketId, 'La salle est verrouillee ou complete.');
            return false;
        }

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

        const content = payload.content.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH);
        if (!content) {
            return;
        }

        const message: ChatMessage = {
            id: crypto.randomUUID(),
            author,
            content,
            createdAt: new Date().toISOString(),
        };

        room.messages.push(message);
        this.events.emit(SocketEvents.WaitingRoomMessageSent, {
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
            this.events.emit(SocketEvents.WaitingRoomCancelled, { accessCode } as WaitingRoomCancelledEvent);
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

        const kickedSocketId = [...room.socketToPlayerId.entries()]
            .find(([, playerId]) => playerId === payload.playerId)?.[0];

        room.players = room.players.filter((player) => player.id !== payload.playerId);
        if (kickedSocketId) {
            room.socketToPlayerId.delete(kickedSocketId);
            this.events.emit(SocketEvents.WaitingRoomPlayerKicked, {
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

        const sessionId = await this.gameSessionService.createSessionFromWaitingRoom(room.mapId, room.players, room.messages);
        this.events.emit(SocketEvents.WaitingRoomGameStarted, {
            accessCode,
            sessionId,
            messages: room.messages,
        } as WaitingRoomGameStartedEvent);
        this.rooms.delete(accessCode);
        this.emitDirectoryUpdated();
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

        this.events.emit(SocketEvents.WaitingRoomUpdated, {
            accessCode: room.accessCode,
            payload,
        } as WaitingRoomUpdatedEvent);
    }

    private emitError(socketId: string, message: string): void {
        this.events.emit(SocketEvents.WaitingRoomError, {
            socketId,
            payload: { message },
        } as WaitingRoomErrorEvent);
    }

    private emitDirectoryUpdated(): void {
        this.events.emit(SocketEvents.WaitingRoomDirectoryUpdated, {
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
        room.isLocked = room.players.length >= room.maxPlayers;
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
