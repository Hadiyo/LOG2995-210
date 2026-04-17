import { Injectable, signal } from '@angular/core';
import { ChatService } from '@app/services/chat/chat.service';
import { CombatResultPayload, CombatTiePayload } from '@app/services/match/combat-state.models';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import { MatchSanctuaryChoice } from '@common/game/match.interface';
import {
    CombatSocketEvents,
    DebugTeleportPlayerPayload,
    EndGameTurnPayload,
    ForceEndDebugTurnPayload,
    GameSessionErrorPayload,
    GameSessionSnapshotPayload,
    JoinGameSessionPayload,
    MoveGamePlayerPayload,
    RequestFlagTransferPayload,
    ResolveFlagTransferPayload,
    ResolveSanctuaryChoicePayload,
    SessionSocketEvents,
    StartCombatPayload,
    SurrenderGamePayload,
    ToggleDebugModePayload,
    ToggleDoorPayload,
    UseSanctuaryPayload,
} from '@common/socket-events';

@Injectable({ providedIn: 'root' })
export class GameSessionSocketService {
    private static readonly debugToggleGuardMs = 400;
    readonly sessionId = signal<string | null>(null);
    readonly errorMessage = signal('');
    readonly logEntries = signal<GameLogEntry[]>([]);

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
        this.logEntries.set([]);
        this.errorMessage.set('');
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

        this.errorMessage.set('');
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

    requestFlagTransfer(playerId: string, teammateId: string): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(CombatSocketEvents.RequestFlagTransfer, {
            sessionId,
            playerId,
            teammateId,
        } satisfies RequestFlagTransferPayload);
    }

    resolveFlagTransfer(playerId: string, accepted: boolean): void {
        const sessionId = this.sessionId();
        if (!sessionId) {
            return;
        }

        this.socketManager.send(CombatSocketEvents.ResolveFlagTransfer, {
            sessionId,
            playerId,
            accepted,
        } satisfies ResolveFlagTransferPayload);
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
            this.logEntries.set(payload.logEntries);
            this.errorMessage.set('');
        });

        this.socketManager.on<GameSessionErrorPayload>(SessionSocketEvents.GameSessionError, (payload) => {
            this.clearDebugToggleGuard();
            this.errorMessage.set(payload.message);
        });

        this.socketManager.on<GameSessionErrorPayload>(CombatSocketEvents.CombatSessionError, (payload) => {
            this.errorMessage.set(payload.message);
        });

        this.socketManager.on<CombatResultPayload>(SessionSocketEvents.CombatVictory, (payload) => {
            this.errorMessage.set('');
            this.matchState.registerCombatVictory(payload.winner);
            this.matchState.applyCombatAftermath([payload.loser]);
        });

        this.socketManager.on<CombatTiePayload>(SessionSocketEvents.CombatTie, (payload) => {
            this.errorMessage.set('');
            this.matchState.applyCombatAftermath([payload.player1, payload.player2]);
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
