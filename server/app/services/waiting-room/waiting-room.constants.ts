import { MapSize } from '@common/maps/map.enums';

export const ACCESS_CODE_LENGTH = 6;
export const ACCESS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MIN_PLAYERS_TO_START = 2;
export const CHAT_MESSAGE_MAX_LENGTH = 300;

export const MAX_PLAYERS_BY_MAP_SIZE: Record<MapSize, number> = {
    [MapSize.S]: 2,
    [MapSize.M]: 4,
    [MapSize.L]: 6,
};
