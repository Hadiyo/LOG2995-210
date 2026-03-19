import { Injectable, signal } from '@angular/core';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import {
    EndGameTurnPayload,
    GameSessionErrorPayload,
    GameSessionSnapshotPayload,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    SocketEvents,
    StartCombatPayload,
    ToggleDoorPayload,
    SurrenderGamePayload,
} from '@common/socket-events';

@Injectable({ providedIn: 'root' })
export class GameSessionSocketService {
    readonly sessionId = signal<string | null>(null);
    readonly errorMessage = signal('');

    private listenersRegistered = false;

    constructor(
        private readonly socketManager: SocketManagerService,
        private readonly matchState: MatchStateService,
        private readonly turnState: TurnStateService,
    ) {}

    joinSession(sessionId: string, playerId: string): void {
        if (!this.socketManager.isSocketAlive()) {
            this.socketManager.connect();
        }
        if (!this.listenersRegistered) {
            this.registerListeners();
            this.listenersRegistered = true;
        }

        this.sessionId.set(sessionId);
        this.socketManager.send(SocketEvents.JoinGameSession, {
            sessionId,
            playerId,
        } satisfies JoinGameSessionPayload);
    }

    movePlayer(playerId: string, direction: MoveGamePlayerPayload['direction']): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SocketEvents.MoveGamePlayer, {
            sessionId,
            playerId,
            direction,
        } satisfies MoveGamePlayerPayload);
    }

    endTurn(playerId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SocketEvents.EndGameTurn, {
            sessionId,
            playerId,
        } satisfies EndGameTurnPayload);
    }

    startCombat(playerId: string, defenderId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SocketEvents.StartCombat, {
            sessionId,
            playerId,
            defenderId,
        } satisfies StartCombatPayload);
    }

    toggleDoor(playerId: string, position: { x: number; y: number }): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SocketEvents.ToggleDoor, {
            sessionId,
            playerId,
            position,
        } satisfies ToggleDoorPayload);
    }

    surrender(playerId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SocketEvents.SurrenderGame, {
            sessionId,
            playerId,
        } satisfies SurrenderGamePayload);
    }

    private registerListeners(): void {
        this.socketManager.on<GameSessionSnapshotPayload>(SocketEvents.GameSessionSnapshot, (payload) => {
            this.sessionId.set(payload.sessionId);
            this.matchState.hydrateSnapshot(payload.match);
            this.turnState.hydrateSnapshot(payload.turnState);
            this.errorMessage.set('');
        });

        this.socketManager.on<GameSessionErrorPayload>(SocketEvents.GameSessionError, (payload) => {
            this.errorMessage.set(payload.message);
        });
    }
}
