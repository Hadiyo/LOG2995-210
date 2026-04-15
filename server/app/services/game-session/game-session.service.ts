import { MapService } from '@app/services/map/map.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { MatchLobbyPlayer, MatchSanctuaryChoice } from '@common/game/match.interface';
import { GameSessionSnapshotPayload, SessionSocketEvents } from '@common/socket-events';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { GameSessionActions } from './game-session.actions';
import { GameSessionLifecycle } from './game-session.lifecycle';
import { GameSessionSessionActions } from './game-session.session-actions';
import { buildSession, GameSessionRuntime } from './game-session.runtime';
import { clearGameSessionTimers } from './game-session.timers';

@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionRuntime>();
    private readonly events = new EventEmitter();
    private readonly lifecycle = new GameSessionLifecycle(this.sessions, this.events);
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
    ): { snapshot: GameSessionSnapshotPayload; previousSessionId: string | null } {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new NotFoundException('Game session not found');
        }

        const playerExists = session.match.players.some((player) => player.id === playerId);
        if (!playerExists) {
            throw new NotFoundException('Game player not found');
        }

        const previousSessionId = this.findSessionIdForSocket(socketId);
        if (previousSessionId && previousSessionId !== sessionId) {
            const previousMembership = this.removeSocket(socketId);
            if (previousMembership) {
                this.sessionActions.surrender(previousMembership.sessionId, previousMembership.playerId);
            }
        }

        session.socketToPlayerId.set(socketId, playerId);
        return {
            snapshot: this.buildSnapshot(session, playerId),
            previousSessionId: previousSessionId && previousSessionId !== sessionId ? previousSessionId : null,
        };
    }

    getSocketIdsForSession(sessionId: string): string[] {
        return [...(this.sessions.get(sessionId)?.socketToPlayerId.keys() ?? [])];
    }

    getSnapshotForSocket(sessionId: string, socketId: string): GameSessionSnapshotPayload | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const playerId = session.socketToPlayerId.get(socketId);
        if (!playerId) {
            return null;
        }

        return this.buildSnapshot(session, playerId);
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
        return this.sessionActions.endTurn(sessionId, playerId);
    }

    requestFlagTransfer(sessionId: string, requesterId: string, receiverId: string): boolean {
        return this.sessionActions.requestFlagTransfer(sessionId, requesterId, receiverId);
    }

    resolveFlagTransfer(sessionId: string, receiverId: string, accepted: boolean): boolean {
        return this.sessionActions.resolveFlagTransfer(sessionId, receiverId, accepted);
    }

    surrender(sessionId: string, playerId: string): boolean {
        return this.sessionActions.surrender(sessionId, playerId);
    }

    toggleDebugMode(sessionId: string, playerId: string): boolean {
        return this.sessionActions.toggleDebugMode(sessionId, playerId);
    }

    forceEndDebugTurn(sessionId: string, playerId: string): boolean {
        return this.sessionActions.forceEndDebugTurn(sessionId, playerId);
    }

    debugTeleportPlayer(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        return this.sessionActions.debugTeleportPlayer(sessionId, playerId, position);
    }

    addChatMessage(sessionId: string, message: ChatMessage): ChatMessage | null {
        return this.sessionActions.addChatMessage(sessionId, message);
    }

    movePlayer(sessionId: string, playerId: string, direction: 'up' | 'down' | 'left' | 'right'): boolean {
        return this.actions.movePlayer(sessionId, playerId, direction);
    }

    useSanctuary(sessionId: string, playerId: string, sanctuaryId: number): boolean {
        return this.actions.useSanctuary(sessionId, playerId, sanctuaryId);
    }

    resolveSanctuaryChoice(sessionId: string, playerId: string, choice: MatchSanctuaryChoice): boolean {
        return this.actions.resolveSanctuaryChoice(sessionId, playerId, choice);
    }

    toggleDoor(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        return this.actions.toggleDoor(sessionId, playerId, position);
    }

    startCombat(sessionId: string, attackerId: string, defenderId: string): boolean {
        return this.actions.startCombat(sessionId, attackerId, defenderId);
    }

    private buildSnapshot(
        session: GameSessionRuntime,
        playerId: string,
    ): GameSessionSnapshotPayload {
        return {
            sessionId: session.sessionId,
            match: session.match,
            turnState: session.turnState,
            messages: session.messages,
            logEntries: session.logEntries
                .filter((entry) => !entry.visibleToPlayerIds || entry.visibleToPlayerIds.includes(playerId))
                .map((entry) => ({ ...entry.entry, involvedPlayers: [...entry.entry.involvedPlayers] })),
        };
    }
}
