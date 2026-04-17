import { ChatService } from '@app/services/chat/chat.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { MapService } from '@app/services/map/map.service';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { GameMode } from '@common/maps/map.enums';
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
    emitWaitingRoomCancelled,
    emitWaitingRoomDirectoryUpdated,
    emitWaitingRoomError,
    emitWaitingRoomGameStarted,
    emitWaitingRoomMessageSent,
    emitWaitingRoomPlayerKicked,
    emitWaitingRoomUpdated,
} from './waiting-room.events';
import { CHAT_MESSAGE_MAX_LENGTH, MIN_PLAYERS_TO_START } from './waiting-room.constants';
import {
    buildWaitingRoomVirtualPlayer,
    findWaitingRoomAccessCode,
    resolveUniqueWaitingRoomPlayerName,
} from './waiting-room-player.utils';
import { WaitingRoom } from './waiting-room.types';
import {
    createJoiningPlayer,
    createOrganizerPlayer,
    createWaitingRoomPreviews,
    createWaitingRoomStatePayload,
    generateWaitingRoomAccessCode,
    removeWaitingRoomPlayerBySocket,
    resolveWaitingRoomMaxPlayers,
    updateWaitingRoomLockState,
} from './waiting-room.utils';

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
        const roomEntries = [...this.rooms.values()].filter(
            (room) => !room.isStarting && !room.isLocked && room.players.length < room.maxPlayers,
        );
        if (roomEntries.length === 0) {
            return [];
        }

        const maps = await this.mapService.getAllMapsSummary();
        const mapsById = new Map(maps.map((map) => [map.id, map]));
        return createWaitingRoomPreviews(roomEntries, mapsById);
    }

    getWaitingRoomState(accessCode: string): WaitingRoomStatePayload | null {
        const room = this.rooms.get(accessCode);
        return room ? createWaitingRoomStatePayload(room) : null;
    }

    async createWaitingRoom(socketId: string, payload: CreateWaitingRoomPayload): Promise<string> {
        const map = await this.mapService.getMapById(payload.mapId);
        this.leaveExistingWaitingRoom(socketId);

        const accessCode = generateWaitingRoomAccessCode(new Set(this.rooms.keys()));
        const room: WaitingRoom = {
            accessCode,
            mapId: payload.mapId,
            mapMode: map.mode,
            organizerSocketId: socketId,
            players: [createOrganizerPlayer(payload.player)],
            messages: [],
            socketToPlayerId: new Map([[socketId, payload.player.id]]),
            isLocked: false,
            isStarting: false,
            maxPlayers: resolveWaitingRoomMaxPlayers(map.size),
        };

        this.rooms.set(accessCode, room);
        this.emitRoomUpdated(room);
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

        room.players.push(
            createJoiningPlayer(payload.player, resolveUniqueWaitingRoomPlayerName(payload.player.name, room)),
        );
        room.socketToPlayerId.set(socketId, payload.player.id);
        updateWaitingRoomLockState(room);
        this.emitRoomUpdated(room);
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
        updateWaitingRoomLockState(room);
        this.emitRoomUpdated(room);
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
        emitWaitingRoomMessageSent(this.events, room.accessCode, message);
    }

    leaveWaitingRoom(socketId: string, accessCode: string): void {
        const room = this.rooms.get(accessCode);
        if (!room) {
            return;
        }

        if (socketId === room.organizerSocketId) {
            this.rooms.delete(accessCode);
            emitWaitingRoomCancelled(this.events, accessCode);
            this.emitDirectoryUpdated();
            return;
        }

        removeWaitingRoomPlayerBySocket(room, socketId);
        updateWaitingRoomLockState(room);
        this.emitRoomUpdated(room);
        this.emitDirectoryUpdated();
    }

    kickPlayer(organizerSocketId: string, payload: KickWaitingRoomPlayerPayload): void {
        const room = this.rooms.get(payload.accessCode);
        if (!room) {
            return;
        }

        if (room.organizerSocketId !== organizerSocketId) {
            this.emitError(organizerSocketId, "Seul l'organisateur peut exclure des joueurs.");
            return;
        }

        const organizerId = room.socketToPlayerId.get(room.organizerSocketId);
        if (payload.playerId === organizerId) {
            this.emitError(organizerSocketId, "L'organisateur ne peut pas etre exclu.");
            return;
        }

        const kickedSocketId = [...room.socketToPlayerId.entries()].find(
            ([, playerId]) => playerId === payload.playerId,
        )?.[0];

        room.players = room.players.filter((player) => player.id !== payload.playerId);
        if (kickedSocketId) {
            room.socketToPlayerId.delete(kickedSocketId);
            emitWaitingRoomPlayerKicked(this.events, payload.accessCode, kickedSocketId);
        }

        updateWaitingRoomLockState(room);
        this.emitRoomUpdated(room);
        this.emitDirectoryUpdated();
    }

    async startGame(organizerSocketId: string, accessCode: string): Promise<void> {
        const room = this.rooms.get(accessCode);
        if (!room) {
            return;
        }

        if (room.organizerSocketId !== organizerSocketId) {
            this.emitError(organizerSocketId, "Seul l'organisateur peut lancer la partie.");
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
        updateWaitingRoomLockState(room);
        this.emitRoomUpdated(room);
        this.emitDirectoryUpdated();

        try {
            if (room.mapMode === GameMode.CTF && room.players.length % 2 !== 0) {
                room.isStarting = false;
                updateWaitingRoomLockState(room);
                this.emitRoomUpdated(room);
                this.emitDirectoryUpdated();
                this.emitError(organizerSocketId, 'Une partie CTF exige un nombre pair de joueurs.');
                return;
            }

            const sessionPlayers = room.players.map((player) => ({ ...player }));
            const sessionMessages = room.messages.map((message) => ({ ...message }));
            const sessionId = await this.gameSessionService.createSessionFromWaitingRoom(
                room.mapId,
                sessionPlayers,
                sessionMessages,
            );

            if (this.rooms.get(accessCode) !== room || room.players.length < MIN_PLAYERS_TO_START) {
                room.isStarting = false;
                updateWaitingRoomLockState(room);
                this.gameSessionService.destroySession(sessionId);
                if (this.rooms.get(accessCode) === room) {
                    this.emitRoomUpdated(room);
                    this.emitDirectoryUpdated();
                }
                return;
            }

            this.rooms.delete(accessCode);
            emitWaitingRoomGameStarted(this.events, accessCode, sessionId, room.messages);
            this.emitDirectoryUpdated();
        } catch (error) {
            room.isStarting = false;
            updateWaitingRoomLockState(room);
            this.emitRoomUpdated(room);
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

    private emitRoomUpdated(room: WaitingRoom): void {
        emitWaitingRoomUpdated(this.events, room, (accessCode) => this.getWaitingRoomState(accessCode));
    }

    private emitError(socketId: string, message: string): void {
        emitWaitingRoomError(this.events, socketId, message);
    }

    private emitDirectoryUpdated(): void {
        emitWaitingRoomDirectoryUpdated(this.events);
    }

    private leaveExistingWaitingRoom(socketId: string, nextAccessCode?: string): void {
        const currentAccessCode = this.getAccessCodeForSocket(socketId);
        if (!currentAccessCode || currentAccessCode === nextAccessCode) {
            return;
        }

        this.leaveWaitingRoom(socketId, currentAccessCode);
    }
}
