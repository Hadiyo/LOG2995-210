export enum SocketEvents {
    MapCreated = 'mapCreated',
    MapUpdated = 'mapUpdated',
    MapDeleted = 'mapDeleted',
    JoinRoom = 'roomJoined',
    LeaveRoom = 'leaveRoom',
    ToogleMapVisibility = 'toggleMapVisibility',
}

export enum SocketRoom {
    MapManagementRoom = 'mapManagementRoom',
}

/** BROWSER SOCKET EVENTS */
export const BEFORE_UNLOAD = 'beforeunload'

export interface MapVisibilityEventPayload {
    id: string,
    visibility: boolean,
}