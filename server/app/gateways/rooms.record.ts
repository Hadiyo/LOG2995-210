// page-room.map.ts
import { PageContext } from '@common/socket-events';

export enum PageRoom {
    MapManagementRoom = 'map_management_room',
    JoinSessionsRoom = 'join_sessions_room',
}

export const pageRoomMap: Record<PageContext, PageRoom> = {
    [PageContext.MapManagement]: PageRoom.MapManagementRoom,
    [PageContext.JoinGame]: PageRoom.JoinSessionsRoom,
};