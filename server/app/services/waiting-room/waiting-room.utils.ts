import { MatchLobbyPlayer } from '@common/game/match.interface';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { MapSummary } from '@common/maps/map.interface';
import { MapSize } from '@common/maps/map.enums';
import { WaitingRoomStatePayload } from '@common/socket-events';
import { createWaitingRoomPreview } from './waiting-room-preview';
import { ACCESS_CODE_CHARS, ACCESS_CODE_LENGTH, MAX_PLAYERS_BY_MAP_SIZE, MIN_PLAYERS_TO_START } from './waiting-room.constants';
import { WaitingRoom } from './waiting-room.types';

export const createWaitingRoomStatePayload = (room: WaitingRoom): WaitingRoomStatePayload => ({
    accessCode: room.accessCode,
    mapId: room.mapId,
    players: room.players,
    messages: room.messages,
    isLocked: room.isLocked,
    maxPlayers: room.maxPlayers,
    minPlayersToStart: MIN_PLAYERS_TO_START,
});

export const createOrganizerPlayer = (player: MatchLobbyPlayer): MatchLobbyPlayer => ({
    ...player,
    isOrganizer: true,
    controller: 'human',
    virtualProfile: null,
});

export const createJoiningPlayer = (player: MatchLobbyPlayer, name: string): MatchLobbyPlayer => ({
    ...player,
    name,
    isOrganizer: false,
    controller: 'human',
    virtualProfile: null,
});

export const createWaitingRoomPreviews = (rooms: WaitingRoom[], mapsById: Map<string, MapSummary>): WaitingRoomPreview[] => {
    const previews: WaitingRoomPreview[] = [];
    for (const room of rooms) {
        const map = mapsById.get(room.mapId);
        if (!map) {
            continue;
        }
        previews.push(createWaitingRoomPreview(room, map));
    }
    return previews;
};

export const generateWaitingRoomAccessCode = (existingCodes: Set<string>): string => {
    let code = '';
    do {
        code = Array.from({ length: ACCESS_CODE_LENGTH }, () =>
            ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)],
        ).join('');
    } while (existingCodes.has(code));
    return code;
};

export const removeWaitingRoomPlayerBySocket = (room: WaitingRoom, socketId: string): void => {
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
};

export const resolveWaitingRoomMaxPlayers = (size: MapSize): number =>
    MAX_PLAYERS_BY_MAP_SIZE[size] ?? MAX_PLAYERS_BY_MAP_SIZE[MapSize.S];

export const updateWaitingRoomLockState = (room: WaitingRoom): void => {
    room.isLocked = room.isStarting || room.players.length >= room.maxPlayers;
};
