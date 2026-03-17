import { ChatMessage } from './chat/chat.interface';
import { InitializedMatch, MatchLobbyPlayer } from './game/match.interface';
import { MatchTurnState } from './game/turn.interface';

export enum SocketEvents {
    MapCreated = 'mapCreated',
    MapUpdated = 'mapUpdated',
    MapDeleted = 'mapDeleted',
    JoinRoom = 'roomJoined',
    LeaveRoom = 'leaveRoom',
    ToggleMapVisibility = 'toggleMapVisibility',

    CreateWaitingRoom = 'createWaitingRoom',
    JoinWaitingRoom = 'joinWaitingRoom',
    LeaveWaitingRoom = 'leaveWaitingRoom',
    KickWaitingRoomPlayer = 'kickWaitingRoomPlayer',
    SendWaitingRoomMessage = 'sendWaitingRoomMessage',
    StartWaitingRoomGame = 'startWaitingRoomGame',

    WaitingRoomUpdated = 'waitingRoomUpdated',
    WaitingRoomDirectoryUpdated = 'waitingRoomDirectoryUpdated',
    WaitingRoomMessageSent = 'waitingRoomMessageSent',
    WaitingRoomPlayerKicked = 'waitingRoomPlayerKicked',
    WaitingRoomCancelled = 'waitingRoomCancelled',
    WaitingRoomGameStarted = 'waitingRoomGameStarted',
    WaitingRoomError = 'waitingRoomError',

    JoinGameSession = 'joinGameSession',
    MoveGamePlayer = 'moveGamePlayer',
    EndGameTurn = 'endGameTurn',
    StartCombat = 'startCombat',
    ToggleDoor = 'toggleDoor',
    SurrenderGame = 'surrenderGame',
    ToggleDebugMode = 'toggleDebugMode',
    ForceEndDebugTurn = 'forceEndDebugTurn',
    DebugTeleportPlayer = 'debugTeleportPlayer',

    GameSessionSnapshot = 'gameSessionSnapshot',
    GameSessionError = 'gameSessionError',
}

export enum ChatSocketEvents {
    SendMessage = 'sendMessage',
    ReceiveMessage = 'receiveMessage',
    LoadChatMessages = 'loadChatMessages',
    ChatValidationError = 'chatValidationError',
    ChatServerError = 'chatServerError',
}

export enum MapSocketEvents {
    MapCreated = 'mapCreated',
    MapUpdated = 'mapUpdated',
    MapDeleted = 'mapDeleted',
    ToggleMapVisibility = 'toggleMapVisibility',
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
    LeaveSession = 'leaveSession',
    AddPlayerToSession = 'addPlayerToSession',
    LeaveSession = 'leaveSession',
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
    InitPlayers = 'InitPlayers',
}

export enum ErrorSocketEvents {
    FailedSessionCreation = 'failedSessionCreation',
    FailedJoinSession = 'failedJoinSession',
    FailedSessionDeletion = 'failedSessionDeletion',
    ServerError = 'serverError',
}

export const BEFORE_UNLOAD = 'beforeunload';

export interface MapVisibilityEventPayload {
    id: string;
    isVisible: boolean;
}

export const getWaitingRoomRoom = (accessCode: string): string => `waiting:${accessCode}`;
export const getGameSessionRoom = (sessionId: string): string => `game:${sessionId}`;

export interface CreateWaitingRoomPayload {
    mapId: string;
    player: MatchLobbyPlayer;
}

export interface JoinWaitingRoomPayload {
    accessCode: string;
    player: MatchLobbyPlayer;
}

export interface LeaveWaitingRoomPayload {
    accessCode: string;
    playerId: string;
}

export interface KickWaitingRoomPlayerPayload {
    accessCode: string;
    playerId: string;
}

export interface SendWaitingRoomMessagePayload {
    accessCode: string;
    content: string;
}

export interface WaitingRoomStatePayload {
    accessCode: string;
    mapId: string;
    players: MatchLobbyPlayer[];
    messages: ChatMessage[];
    isLocked: boolean;
    maxPlayers: number;
    minPlayersToStart: number;
}

export interface WaitingRoomGameStartedPayload {
    accessCode: string;
    sessionId: string;
    messages: ChatMessage[];
}

export interface WaitingRoomErrorPayload {
    message: string;
}

export interface JoinGameSessionPayload {
    sessionId: string;
    playerId: string;
}

export interface MoveGamePlayerPayload {
    sessionId: string;
    playerId: string;
    direction: 'up' | 'down' | 'left' | 'right';
}

export interface EndGameTurnPayload {
    sessionId: string;
    playerId: string;
}

export interface StartCombatPayload {
    sessionId: string;
    playerId: string;
    defenderId: string;
}

export interface ToggleDoorPayload {
    sessionId: string;
    playerId: string;
    position: { x: number; y: number };
}

export interface SurrenderGamePayload {
    sessionId: string;
    playerId: string;
}

export interface ToggleDebugModePayload {
    sessionId: string;
    playerId: string;
}

export interface ForceEndDebugTurnPayload {
    sessionId: string;
    playerId: string;
}

export interface DebugTeleportPlayerPayload {
    sessionId: string;
    playerId: string;
    position: { x: number; y: number };
}

export interface GameSessionSnapshotPayload {
    sessionId: string;
    match: InitializedMatch;
    turnState: MatchTurnState;
    messages: ChatMessage[];
}

export interface GameSessionErrorPayload {
    message: string;
}
