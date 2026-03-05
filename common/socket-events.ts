export enum MapSocketEvents {
    MapCreated = 'mapCreated',
    MapUpdated = 'mapUpdated',
    MapDeleted = 'mapDeleted',
    ToogleMapVisibility = 'toggleMapVisibility',
}

export enum PageSocketEvents {
    JoinPage = 'joinPage',
    LeavePage = 'leavePage',
}

export enum PageContext {
    MapManagement = 'mapManagement',
    JoinGame = 'joinGame',
}

export enum RoomSocketEvents {
    JoinGameRoom = 'gameRoomJoined',
    LeaveGameRoom = 'leaveGameRoom',
    CreateGameSession = 'createGameSession',
    GameSessionCreated = 'gameSessionCreated',
    PlayerJoinedGame = 'playerJoinedGame',
    PlayerLeftGame = 'playerLeftGame',
    UpdatePlayerCount = 'updatePlaterCount',
}

export enum ErrorSocketEvents {
    FailedSessionCreation = 'failedSessionCreation',
    FailedJoinSession = 'failedJoinSession',
    ServerError = 'serverError',
}

/** BROWSER SOCKET EVENTS */
export const BEFORE_UNLOAD = 'beforeunload'

export interface MapVisibilityEventPayload {
    id: string,
    isVisible: boolean,
}