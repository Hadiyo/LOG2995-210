export enum SocketEvents {
    MapCreated = 'mapCreated',
    MapUpdated = 'mapUpdated',
    MapDeleted = 'mapDeleted',
    JoinRoom = 'room-joined',
    LeaveRoom = 'leaveRoom',
}

export enum SocketRoom {
    MapManagementRoot = 'mapManagementRoom',
}

/** BROWSER SOCKET EVENTS */
export const BEFORE_UNLOAD = 'beforeunload'