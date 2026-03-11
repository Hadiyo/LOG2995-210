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
    CreateGameSession = 'createGameSession',
    NewAvailableSession = 'newSessionAvailable',
    PlayerJoinedGame = 'playerJoinedGame',
    IncrementPlayerCount = 'incrementPlayerCount',
    DecrementPlayerCount = 'decrementPlayerCount',
    AddClientToSession = 'addClientToSession',
}

export enum WaitingRoomEvents {
    LeaveGameRoom = 'leaveGameRoom',
    DeleteGameSession = 'deleteGameSession',
    GameSessionDeleted = 'gameSessionDeleted',
    PlayerJoinedSession = 'playerJoinedSession',
    PlayerLeftSession = 'playerLeftSession',
    ClientJoinedSession = 'clientJoinedSession',
}

export enum ErrorSocketEvents {
    FailedSessionCreation = 'failedSessionCreation',
    FailedJoinSession = 'failedJoinSession',
    FailedSessionDeletion = 'failedSessionDeletion',
    ServerError = 'serverError',
}

/** BROWSER SOCKET EVENTS */
export const BEFORE_UNLOAD = 'beforeunload'

export interface MapVisibilityEventPayload {
    id: string,
    isVisible: boolean,
}