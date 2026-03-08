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
    DeleteGameSession = 'deleteGameSession',
    GameSessionDeleted = 'gameSessionDeleted',
    PlayerJoinedGame = 'playerJoinedGame',
    PlayerLeftGame = 'playerLeftGame',
    IncrementPlayerCount = 'incrementPlayerCount',
    DecrementPlayerCount = 'decrementPlayerCount',
    AddCharacterToPlayer = 'addCharacterToPlayer',
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