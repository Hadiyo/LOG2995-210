export enum MapSocketEvents {
    MapCreated = 'mapCreated',
    MapUpdated = 'mapUpdated',
    MapDeleted = 'mapDeleted',
    ToogleMapVisibility = 'toggleMapVisibility',
}

export enum RoomSocketEvents {
    JoinSessionRoom = 'roomSessionJoined',
    JoinGameRoom = 'gameRoomJoined',
    LeaveSessionRoom = 'leaveSessionRoom',
    LeaveGameRoom = 'leaveGameRoom',
}

export enum SocketRoom {
    MapManagementRoom = 'mapManagementRoom',
}

/** BROWSER SOCKET EVENTS */
export const BEFORE_UNLOAD = 'beforeunload'

export interface MapVisibilityEventPayload {
    id: string,
    isVisible: boolean,
}