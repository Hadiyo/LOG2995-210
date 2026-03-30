import { Injectable, signal } from '@angular/core';
import { ChatService } from '@app/services/chat/chat.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import {
    CombatSocketEvents,
    DebugTeleportPlayerPayload,
    EndGameTurnPayload,
    ForceEndDebugTurnPayload,
    GameSessionErrorPayload,
    GameSessionSnapshotPayload,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    ResolveSanctuaryChoicePayload,
    SessionSocketEvents,
    StartCombatPayload,
    ToggleDoorPayload,
    UseSanctuaryPayload,
    SurrenderGamePayload,
    ToggleDebugModePayload,
} from '@common/socket-events';
import { MatchSanctuaryChoice } from '@common/game/match.interface';

@Injectable({ providedIn: 'root' })
export class GameSessionSocketService {
    private static readonly debugToggleGuardMs = 400;
    readonly sessionId = signal<string | null>(null);
    readonly errorMessage = signal('');

    private listenersRegistered = false;
    private debugTogglePending = false;
    private debugToggleTimeoutId: number | null = null;

    constructor(
        private readonly socketManager: SocketManagerService,
        private readonly matchState: MatchStateService,
        private readonly turnState: TurnStateService,
        private readonly chatService: ChatService,
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
        this.socketManager.send(SessionSocketEvents.JoinGameSession, {
            sessionId,
            playerId,
        } satisfies JoinGameSessionPayload);
    }

    movePlayer(playerId: string, direction: MoveGamePlayerPayload['direction']): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(CombatSocketEvents.MoveGamePlayer, {
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

        this.socketManager.send(CombatSocketEvents.EndGameTurn, {
            sessionId,
            playerId,
        } satisfies EndGameTurnPayload);
    }

    useSanctuary(playerId: string, sanctuaryId: number): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(CombatSocketEvents.UseSanctuary, {
            sessionId,
            playerId,
            sanctuaryId,
        } satisfies UseSanctuaryPayload);
    }

    resolveSanctuaryChoice(playerId: string, choice: MatchSanctuaryChoice): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(CombatSocketEvents.ResolveSanctuaryChoice, {
            sessionId,
            playerId,
            choice,
        } satisfies ResolveSanctuaryChoicePayload);
    }

    startCombat(playerId: string, defenderId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(CombatSocketEvents.StartCombat, {
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

        this.socketManager.send(CombatSocketEvents.ToggleDoor, {
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

        this.socketManager.send(SessionSocketEvents.SurrenderGame, {
            sessionId,
            playerId,
        } satisfies SurrenderGamePayload);
    }

    toggleDebugMode(playerId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId || this.debugTogglePending) {
            return;
        }

        this.debugTogglePending = true;
        this.debugToggleTimeoutId = window.setTimeout(() => {
            this.debugTogglePending = false;
            this.debugToggleTimeoutId = null;
        }, GameSessionSocketService.debugToggleGuardMs);

        this.socketManager.send(SessionSocketEvents.ToggleDebugMode, {
            sessionId,
            playerId,
        } satisfies ToggleDebugModePayload);
    }

    forceEndDebugTurn(playerId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SessionSocketEvents.ForceEndDebugTurn, {
            sessionId,
            playerId,
        } satisfies ForceEndDebugTurnPayload);
    }

    debugTeleportPlayer(playerId: string, position: { x: number; y: number }): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(SessionSocketEvents.DebugTeleportPlayer, {
            sessionId,
            playerId,
            position,
        } satisfies DebugTeleportPlayerPayload);
    }

    private registerListeners(): void {
        this.socketManager.on<GameSessionSnapshotPayload>(SessionSocketEvents.GameSessionSnapshot, (payload) => {
            this.clearDebugToggleGuard();
            this.sessionId.set(payload.sessionId);
            this.matchState.hydrateSnapshot(payload.match);
            this.turnState.hydrateSnapshot(payload.turnState);
            this.chatService.loadChatMessages(payload.messages);
            this.errorMessage.set('');
        });

        this.socketManager.on<GameSessionErrorPayload>(SessionSocketEvents.GameSessionError, (payload) => {
            this.clearDebugToggleGuard();
            this.errorMessage.set(payload.message);
        });
    }

    private clearDebugToggleGuard(): void {
        this.debugTogglePending = false;
        if (this.debugToggleTimeoutId !== null) {
            window.clearTimeout(this.debugToggleTimeoutId);
            this.debugToggleTimeoutId = null;
        }
    }
}
