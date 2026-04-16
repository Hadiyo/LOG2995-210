import { CombatService } from '@app/services/combat/combat.service';
import { MapService } from '@app/services/map/map.service';
import { canStartCombat } from '@app/services/game-session/game-session.runtime';
import { clearTimers } from '@app/services/timer/turn.timers';
import { GameSessionEvents } from '@app/utilities/combat/combat.enums';
import { ATTACK_POSE_DURATION_MS } from '@app/utilities/game/game.constants';
import { GameSessionRuntime } from '@app/utilities/game/game.interface';
import { ChatMessage } from '@common/chat/chat.interface';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer, MatchSanctuaryChoice } from '@common/game/match.interface';
import { PlayerPose } from '@common/player/player.interface';
import { GameSessionSnapshotPayload, SessionSocketEvents } from '@common/socket-events';
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'events';
import { GameSessionActions } from './game-session.actions';
import { GameSessionLifecycle } from './game-session.lifecycle';
import { applyFacingTowardPosition, setTransientPose } from './game-session.render';
import { buildSession } from './game-session.runtime';
import { GameSessionSessionActions } from './game-session.session-actions';
import { planVirtualPlayerDecision } from './game-session.virtual-player';

const VIRTUAL_PLAYER_MIN_DELAY_MS = 450;
const VIRTUAL_PLAYER_DELAY_VARIANCE_MS = 450;
@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionRuntime>();
    private readonly events = new EventEmitter();
    private readonly event2 = new EventEmitter2();
    private readonly lifecycle = new GameSessionLifecycle(this.sessions, this.events, (session) => this.scheduleVirtualDecision(session));
    private readonly sessionActions = new GameSessionSessionActions(this.sessions, this.lifecycle);
    private readonly actions = new GameSessionActions(this.sessions, this.lifecycle);

    constructor(
        private readonly mapService: MapService,
        @Inject(forwardRef(() => CombatService)) private readonly combatService: CombatService,
    ) {}

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
    
    getSessionById(id: string): GameSessionRuntime | undefined {
        return this.sessions.get(id);
    }

    getMatchFromSessionId(id: string): InitializedMatch | null {
        return this.sessions.get(id)?.match ?? null;
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

    getSocketFromPlayer(sessionId: string, playerId: string | undefined): string | null {
        const session = this.sessions.get(sessionId);
        if(!session || !playerId)
            return null;
        for (const [socketId, pId] of session.socketToPlayerId) {
            if (pId === playerId) {
                return socketId;
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
            const payload = { sessionId: session.sessionId, playerId };
            return payload;
        }

        return null;
    }

    destroySession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        clearTimers(session);
        this.sessions.delete(sessionId);
        this.event2.emit(GameSessionEvents.OnGameEnd, { id: sessionId });
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

    startCombat(sessionId: string, attackerId: string, defenderId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== attackerId ||
            session.turnState.actionTaken ||
            session.match.pendingSanctuaryChoice ||
            session.match.endState) {
            return false;
        }

        const attacker = session.match.players.find((player) => player.id === attackerId);
        const defender = session.match.players.find((player) => player.id === defenderId);
        if (!attacker || !defender || !canStartCombat(attacker, defender)) {
            return false;
        }

        const combatStart = this.combatService.createCombatSession(attackerId, defenderId, sessionId);
        if (!combatStart) {
            return false;
        }

        session.match = {
            ...session.match,
            players: session.match.players.map((player) =>
                player.id === attackerId
                    ? {
                        ...player,
                        render: setTransientPose(
                            applyFacingTowardPosition(player, defender.position),
                            PlayerPose.Attack,
                            ATTACK_POSE_DURATION_MS,
                        ).render,
                    }
                    : player,
            ),
        };
        session.turnState = {
            ...session.turnState,
            actionTaken: true,
        };
        this.lifecycle.emitSnapshot(session);
        this.lifecycle.stopSessionTimers(session);
        this.combatService.startCombat(combatStart.combat);
        return true;
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

    resumeSessionTurns(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) this.lifecycle.resumeGameSessionTurn(session);
    }

    stopSessionTimers(session: GameSessionRuntime): void {
        this.lifecycle.stopSessionTimers(session);
    }

    endCombat(sessionId: string, winnerId: string, loserId: string): void {
        this.sessionActions.resolveCombatEnd(sessionId, winnerId, loserId);
    }

    resolveCombatTie(sessionId: string, winnerId: string, loserId: string): void {
        this.sessionActions.resolveCombatTie(sessionId, winnerId, loserId);
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

    appendCombatRoundLogs(sessionId: string, statistics: CombatPlayerStatistics[]): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.lifecycle.appendCombatRoundLogEntries(session, statistics);
        this.lifecycle.emitSnapshot(session);
    }

    private buildSnapshot(session: GameSessionRuntime, playerId: string): GameSessionSnapshotPayload {
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

    private performVirtualDecision(sessionId: string, playerId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        const activeVirtualPlayer = this.getActiveVirtualPlayer(session);
        if (!activeVirtualPlayer || activeVirtualPlayer.id !== playerId) {
            return;
        }

        if (session.match.pendingSanctuaryChoice?.playerId === playerId) {
            const choice = activeVirtualPlayer.virtualProfile === 'aggressive' ? 'double-or-nothing' : 'normal';
            this.resolveSanctuaryChoice(sessionId, playerId, choice);
            return;
        }

        const decision = planVirtualPlayerDecision(session.match, session.turnState, activeVirtualPlayer);
        this.executeVirtualDecision(sessionId, playerId, decision);
    }

    private getActiveVirtualPlayer(session: GameSessionRuntime): MatchPlayer | null {
        if (session.turnState.phase !== 'active' || !session.turnState.activePlayerId) {
            return null;
        }

        const activePlayer = session.match.players.find((player) => player.id === session.turnState.activePlayerId) ?? null;
        return activePlayer?.controller === 'virtual' ? activePlayer : null;
    }

    private executeVirtualDecision(
        sessionId: string,
        playerId: string,
        decision: ReturnType<typeof planVirtualPlayerDecision>,
    ): void {
        switch (decision.kind) {
            case 'combat':
                this.runVirtualDecisionAction(() => this.startCombat(sessionId, playerId, decision.targetId), sessionId, playerId);
                return;
            case 'move':
                this.runVirtualDecisionAction(() => this.movePlayer(sessionId, playerId, decision.direction), sessionId, playerId);
                return;
            case 'toggle-door':
                this.runVirtualDecisionAction(() => this.toggleDoor(sessionId, playerId, decision.position), sessionId, playerId);
                return;
            case 'use-sanctuary':
                this.runVirtualDecisionAction(() => this.useSanctuary(sessionId, playerId, decision.sanctuaryId), sessionId, playerId);
                return;
            case 'end-turn':
                this.endTurn(sessionId, playerId);
                return;
            default:
                return;
        }
    }

    private runVirtualDecisionAction(action: () => boolean, sessionId: string, playerId: string): void {
        if (!action()) this.endTurn(sessionId, playerId);
    }
}
