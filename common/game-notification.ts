export enum GameNotificationKind {
    TurnEndedEarly = 'TURN_ENDED_EARLY',
    TurnTimedOut = 'TURN_TIMED_OUT',
    PlayerSurrendered = 'PLAYER_SURRENDERED',
    PlayerEliminated = 'PLAYER_ELIMINATED',
    GameEnded = 'GAME_ENDED',
}

// Realtime gameplay notification shown outside chat (toast/panel).
export interface GameNotification {
    kind: GameNotificationKind;
    content: string;
    createdAt: string;
}
