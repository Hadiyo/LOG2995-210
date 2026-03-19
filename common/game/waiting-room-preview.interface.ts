import { PreviewImageFormat } from '@common/enum';
import { GameMode, MapSize } from '@common/maps/map.enums';

export interface WaitingRoomPreview {
    accessCode: string;
    mapId: string;
    name: string;
    description: string;
    mode: GameMode;
    size: MapSize;
    playerCount: number;
    maxPlayers: number;
    isLocked?: boolean;
    previewImage?: string;
    previewImageFormat?: PreviewImageFormat;
}
