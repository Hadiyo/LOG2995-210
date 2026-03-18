import { MapSummary } from '@common/maps/map.interface';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { WaitingRoom } from './waiting-room.types';

export function createWaitingRoomPreview(room: WaitingRoom, map: MapSummary): WaitingRoomPreview {
    return {
        accessCode: room.accessCode,
        mapId: room.mapId,
        name: map.name,
        description: map.description,
        mode: map.mode,
        size: map.size,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        previewImage: map.previewImage,
        previewImageFormat: map.previewImageFormat,
    };
}
