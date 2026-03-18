export type TurnPhase = 'transition' | 'active';
export type PlayerTurnInteractionState = 'waiting' | 'active';

export interface MatchTurnOrderEntry {
    playerId: string;
    speed: number;
}

export interface MatchPlayerTurnState {
    playerId: string;
    state: PlayerTurnInteractionState;
}

export interface MatchTurnState {
    matchId: string;
    hasStarted: boolean;
    order: MatchTurnOrderEntry[];
    currentTurnIndex: number;
    phase: TurnPhase;
    activePlayerId: string | null;
    transitionTargetPlayerId: string | null;
    transitionEndsAt: number | null;
    transitionRemainingMs: number;
    activeTurnEndsAt: number | null;
    activeTurnRemainingMs: number;
    movementPointsRemaining: number;
    actionTaken: boolean;
    movementCount: number;
    playerStates: MatchPlayerTurnState[];
}
