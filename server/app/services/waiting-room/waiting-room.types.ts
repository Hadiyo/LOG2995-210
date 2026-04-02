import { ChatMessage } from '@common/chat/chat.interface';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { GameMode } from '@common/maps/map.enums';
import { WaitingRoomErrorPayload, WaitingRoomStatePayload } from '@common/socket-events';

export interface WaitingRoom {
    accessCode: string;
    mapId: string;
    mapMode: GameMode;
    organizerSocketId: string;
    players: MatchLobbyPlayer[];
    messages: ChatMessage[];
    socketToPlayerId: Map<string, string>;
    isLocked: boolean;
    isStarting: boolean;
    maxPlayers: number;
}

export interface WaitingRoomUpdatedEvent {
    accessCode: string;
    payload: WaitingRoomStatePayload;
}

export interface WaitingRoomPlayerKickedEvent {
    accessCode: string;
    kickedSocketId: string;
}

export interface WaitingRoomCancelledEvent {
    accessCode: string;
}

export interface WaitingRoomGameStartedEvent {
    accessCode: string;
    sessionId: string;
    messages: ChatMessage[];
}

export interface WaitingRoomDirectoryUpdatedEvent {
    updatedAt: string;
}

export interface WaitingRoomErrorEvent {
    socketId: string;
    payload: WaitingRoomErrorPayload;
}

export interface WaitingRoomMessageSentEvent {
    accessCode: string;
    payload: ChatMessage;
}
