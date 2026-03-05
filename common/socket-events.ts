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
    CreateGameSession = 'createGameSession',
    GameSessionCreated = 'gameSessionCreated',
    PlayerJoinedGame = 'playerJoinedGame',
    PlayerLeftGame = 'playerLeftGame',
}

export enum ErrorSocketEvents {
    FailedSessionCreation = 'failedSessionCreation',
    FailedJoinSession = 'failedJoinSession',
    ServerError = 'serverError',
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