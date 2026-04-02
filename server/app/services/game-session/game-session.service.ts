import { MapService } from '@app/services/map/map.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer, MatchSanctuaryChoice } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { SessionSocketEvents } from '@common/socket-events';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { GameSessionActions } from './game-session.actions';
import { GameSessionLifecycle } from './game-session.lifecycle';
import { buildSession, GameSessionRuntime } from './game-session.runtime';
import { GameSessionSessionActions } from './game-session.session-actions';
import { clearGameSessionTimers } from './game-session.timers';
import { planVirtualPlayerDecision } from './game-session.virtual-player';

const VIRTUAL_PLAYER_MIN_DELAY_MS = 450;
const VIRTUAL_PLAYER_DELAY_VARIANCE_MS = 450;

@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionRuntime>();
    private readonly events = new EventEmitter();
    private readonly lifecycle = new GameSessionLifecycle(this.sessions, this.events, (session) => this.scheduleVirtualDecision(session));
    private readonly sessionActions = new GameSessionSessionActions(this.sessions, this.lifecycle);
    private readonly actions = new GameSessionActions(this.sessions, this.lifecycle);

    constructor(private readonly mapService: MapService) {}

    on<T>(event: SessionSocketEvents, callback: (payload: T) => void): void {
        this.events.on(event, callback);
    }

    off<T>(event: SessionSocketEvents, callback: (payload: T) => void): void {
        this.events.off(event, callback);
    }

    async createSessionFromWaitingRoom(mapId: string, players: MatchLobbyPlayer[], messages: ChatMessage[] = []): Promise<string> {
        const map = await this.mapService.getMapByIdForEditor(mapId);
        const session = buildSession(map, players, messages);
        this.sessions.set(session.sessionId, session);
        this.lifecycle.emitSnapshot(session);
        this.lifecycle.startTransition(session);
        return session.sessionId;
    }

    registerSocket(
        sessionId: string,
        playerId: string,
        socketId: string,
    ): { match: InitializedMatch; turnState: MatchTurnState; messages: ChatMessage[]; previousSessionId: string | null } {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new NotFoundException('Game session not found');
        }

        const player = session.match.players.find((candidate) => candidate.id === playerId) ?? null;
        if (!player || player.controller === 'virtual') {
            throw new NotFoundException('Game player not found');
        }

        const previousSessionId = this.findSessionIdForSocket(socketId);
        if (previousSessionId && previousSessionId !== sessionId) {
            const previousMembership = this.removeSocket(socketId);
            if (previousMembership) {
                this.surrender(previousMembership.sessionId, previousMembership.playerId);
            }
        }

        session.socketToPlayerId.set(socketId, playerId);
        return {
            match: session.match,
            turnState: session.turnState,
            messages: session.messages,
            previousSessionId: previousSessionId && previousSessionId !== sessionId ? previousSessionId : null,
        };
    }

    getPlayerIdForSocket(socketId: string, sessionId: string): string | null {
        return this.sessions.get(sessionId)?.socketToPlayerId.get(socketId) ?? null;
    }

    getPlayerNameForSocket(socketId: string, sessionId: string): string | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const playerId = session.socketToPlayerId.get(socketId);
        return session.match.players.find((player) => player.id === playerId)?.name ?? null;
    }

    findSessionIdForSocket(socketId: string): string | null {
        for (const session of this.sessions.values()) {
            if (session.socketToPlayerId.has(socketId)) {
                return session.sessionId;
            }
        }

        return null;
    }

    removeSocket(socketId: string): { sessionId: string; playerId: string } | null {
        for (const session of this.sessions.values()) {
            const playerId = session.socketToPlayerId.get(socketId);
            if (!playerId) {
                continue;
            }

            session.socketToPlayerId.delete(socketId);
            const playerStillConnected = [...session.socketToPlayerId.values()].some((connectedPlayerId) => connectedPlayerId === playerId);
            if (playerStillConnected) {
                return null;
            }

            return { sessionId: session.sessionId, playerId };
        }

        return null;
    }

    destroySession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        clearGameSessionTimers(session);
        this.sessions.delete(sessionId);
    }

    endTurn(sessionId: string, playerId: string): boolean {
        return this.runSessionAction(sessionId, () => this.sessionActions.endTurn(sessionId, playerId));
    }

    requestFlagTransfer(sessionId: string, requesterId: string, receiverId: string): boolean {
        const success = this.runSessionAction(sessionId, () => this.sessionActions.requestFlagTransfer(sessionId, requesterId, receiverId));
        if (!success) {
            return false;
        }

        const session = this.sessions.get(sessionId);
        const receiver = session?.match.players.find((player) => player.id === receiverId) ?? null;
        if (receiver?.controller === 'virtual') {
            return this.resolveFlagTransfer(sessionId, receiverId, true);
        }

        return true;
    }

    resolveFlagTransfer(sessionId: string, receiverId: string, accepted: boolean): boolean {
        return this.runSessionAction(sessionId, () => this.sessionActions.resolveFlagTransfer(sessionId, receiverId, accepted));
    }

    surrender(sessionId: string, playerId: string): boolean {
        return this.runSessionAction(sessionId, () => this.sessionActions.surrender(sessionId, playerId));
    }

    toggleDebugMode(sessionId: string, playerId: string): boolean {
        return this.runSessionAction(sessionId, () => this.sessionActions.toggleDebugMode(sessionId, playerId));
    }

    forceEndDebugTurn(sessionId: string, playerId: string): boolean {
        return this.runSessionAction(sessionId, () => this.sessionActions.forceEndDebugTurn(sessionId, playerId));
    }

    debugTeleportPlayer(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        return this.runSessionAction(sessionId, () => this.sessionActions.debugTeleportPlayer(sessionId, playerId, position));
    }

    addChatMessage(sessionId: string, message: ChatMessage): ChatMessage | null {
        return this.sessionActions.addChatMessage(sessionId, message);
    }

    movePlayer(sessionId: string, playerId: string, direction: 'up' | 'down' | 'left' | 'right'): boolean {
        return this.runSessionAction(sessionId, () => this.actions.movePlayer(sessionId, playerId, direction));
    }

    useSanctuary(sessionId: string, playerId: string, sanctuaryId: number): boolean {
        return this.runSessionAction(sessionId, () => this.actions.useSanctuary(sessionId, playerId, sanctuaryId));
    }

    resolveSanctuaryChoice(sessionId: string, playerId: string, choice: MatchSanctuaryChoice): boolean {
        return this.runSessionAction(sessionId, () => this.actions.resolveSanctuaryChoice(sessionId, playerId, choice));
    }

    toggleDoor(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        return this.runSessionAction(sessionId, () => this.actions.toggleDoor(sessionId, playerId, position));
    }

    startCombat(sessionId: string, attackerId: string, defenderId: string): boolean {
        return this.runSessionAction(sessionId, () => this.actions.startCombat(sessionId, attackerId, defenderId));
    }

    private runSessionAction(sessionId: string, action: () => boolean): boolean {
        const success = action();
        if (!success) {
            return false;
        }

        const session = this.sessions.get(sessionId);
        if (session) {
            this.scheduleVirtualDecision(session);
        }

        return true;
    }

    private scheduleVirtualDecision(session: GameSessionRuntime): void {
        if (session.virtualDecisionTimeoutId) {
            clearTimeout(session.virtualDecisionTimeoutId);
            session.virtualDecisionTimeoutId = null;
        }

        const activeVirtualPlayer = this.getActiveVirtualPlayer(session);
        if (!activeVirtualPlayer || session.match.endState) {
            return;
        }

        const delayMs = VIRTUAL_PLAYER_MIN_DELAY_MS + Math.floor(Math.random() * VIRTUAL_PLAYER_DELAY_VARIANCE_MS);
        session.virtualDecisionTimeoutId = setTimeout(() => {
            session.virtualDecisionTimeoutId = null;
            this.performVirtualDecision(session.sessionId, activeVirtualPlayer.id);
        }, delayMs);
    }

    private performVirtualDecision(sessionId: string, playerId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        const activeVirtualPlayer = this.getActiveVirtualPlayer(session);
        if (!activeVirtualPlayer || activeVirtualPlayer.id !== playerId) {
            return;
        }

        const decision = planVirtualPlayerDecision(session.match, session.turnState, activeVirtualPlayer);
        switch (decision.kind) {
            case 'combat':
                if (!this.startCombat(sessionId, playerId, decision.targetId)) {
                    this.endTurn(sessionId, playerId);
                }
                return;
            case 'move':
                if (!this.movePlayer(sessionId, playerId, decision.direction)) {
                    this.endTurn(sessionId, playerId);
                }
                return;
            case 'toggle-door':
                if (!this.toggleDoor(sessionId, playerId, decision.position)) {
                    this.endTurn(sessionId, playerId);
                }
                return;
            case 'end-turn':
                this.endTurn(sessionId, playerId);
                return;
            default:
                return;
        }
    }

    private getActiveVirtualPlayer(session: GameSessionRuntime): MatchPlayer | null {
        if (session.turnState.phase !== 'active' || !session.turnState.activePlayerId) {
            return null;
        }

        const activePlayer = session.match.players.find((player) => player.id === session.turnState.activePlayerId) ?? null;
        return activePlayer?.controller === 'virtual' ? activePlayer : null;
    }
}
