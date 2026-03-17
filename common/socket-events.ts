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

export enum ChatSocketEvents {
    SendMessage = 'sendMessage',
    ReceiveMessage = 'receiveMessage',
    LoadChatMessages = 'loadChatMessages',
    ChatValidationError = 'chatValidationError',
    ChatServerError = 'chatServerError',
}

export enum WaitingRoomEvents {
    LeaveGameRoom = 'leaveGameRoom',
    DeleteGameSession = 'deleteGameSession',
    GameSessionDeleted = 'gameSessionDeleted',
    PlayerJoinedSession = 'playerJoinedSession',
    PlayerLeftSession = 'playerLeftSession',
    ClientJoinedSession = 'clientJoinedSession',
    KickPlayer = 'kickPlayer',
    KickedFromSession = 'kickedFromSession',
    WaitingRoomState = 'waitingRoomState',
    StartGame = 'waitingRoomStartGame',
    GameStarted = 'waitingRoomGameStarted',
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
