/* eslint-disable max-lines */
import { MapService } from '@app/services/map/map.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer, MatchSanctuaryChoice } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { PlayerPose } from '@common/player/player.interface';
import { SessionSocketEvents } from '@common/socket-events';
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { canUseDebugTeleport, isDebugTeleportDestinationAvailable } from './game-session.debug';
import {
    ATTACK_POSE_DURATION_MS,
    buildGameSessionVisibleObjects,
    getGameSessionDestination,
    getGameSessionMovementCost,
    WALK_POSE_DURATION_MS,
} from './game-session.match';
import { applyFacingTowardPosition, setTransientPose } from './game-session.render';
import {
    beginGameSessionSanctuaryChoice,
    progressGameSessionSanctuaryEffects,
    resolveGameSessionSanctuaryChoice,
} from './game-session.sanctuary';
import {
    ACTIVE_TURN_DURATION_MS,
    buildSession,
    canStartCombat,
    CLASSIC_WIN_THRESHOLD,
    createActiveTurnState,
    createTransitionTurnState,
    GameSessionRuntime,
    rebuildTurnStateAfterRosterChange,
    resolveRespawnPosition,
    SNAPSHOT_TICK_MS,
    TRANSITION_DURATION_MS,
} from './game-session.runtime';
import { clearGameSessionTimers, tickGameSessionTimers } from './game-session.timers';

@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionRuntime>();
    private readonly events = new EventEmitter();

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
        this.emitSnapshot(session);
        this.startTransition(session);
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

        const playerExists = session.match.players.some((player) => player.id === playerId);
        if (!playerExists) {
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
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.match.pendingSanctuaryChoice) {
            return false;
        }

        this.advanceToNextTurn(session);
        return true;
    }

    surrender(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        const departingPlayer = session.match.players.find((player) => player.id === playerId);
        const organizerLeftWhileDebugEnabled = !!departingPlayer?.isOrganizer && session.match.debugMode;

        const nextPlayers = session.match.players.filter((player) => player.id !== playerId);
        if (nextPlayers.length === session.match.players.length) {
            return false;
        }

        session.match = {
            ...session.match,
            debugMode: organizerLeftWhileDebugEnabled ? false : session.match.debugMode,
            players: nextPlayers,
            objects: buildGameSessionVisibleObjects(session.match.allObjects, nextPlayers),
            pendingSanctuaryChoice: session.match.pendingSanctuaryChoice?.playerId === playerId
                ? null
                : session.match.pendingSanctuaryChoice ?? null,
        };

        if (nextPlayers.length === 0) {
            clearGameSessionTimers(session);
            this.sessions.delete(sessionId);
            return true;
        }

        if (nextPlayers.length === 1) {
            const remainingPlayer = nextPlayers[0];
            session.match = {
                ...session.match,
                endState: {
                    id: crypto.randomUUID(),
                    winnerKind: 'none',
                    winnerPlayerId: null,
                    message: `La partie se termine sans gagnant: ${remainingPlayer.name} est le dernier joueur encore en partie apres les abandons.`,
                    resolvedAt: Date.now(),
                },
            };
            this.finishMatch(session);
            return true;
        }

        const removedActivePlayer = session.turnState.activePlayerId === playerId ||
            session.turnState.transitionTargetPlayerId === playerId;
        if (removedActivePlayer) {
            session.turnState = rebuildTurnStateAfterRosterChange(session.turnState, nextPlayers);
            this.startTransition(session);
            return true;
        }

        session.turnState = rebuildTurnStateAfterRosterChange(session.turnState, nextPlayers);
        this.emitSnapshot(session);
        return true;
    }

    toggleDebugMode(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        const player = session?.match.players.find((candidate) => candidate.id === playerId);
        if (!session || !player?.isOrganizer) {
            return false;
        }

        session.match = {
            ...session.match,
            debugMode: !session.match.debugMode,
        };
        this.emitSnapshot(session);
        return true;
    }

    forceEndDebugTurn(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        const player = session?.match.players.find((candidate) => candidate.id === playerId);
        if (!session || !session.match.debugMode || !player?.isOrganizer || session.match.endState) {
            return false;
        }

        this.advanceToNextTurn(session);
        return true;
    }

    debugTeleportPlayer(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        const session = this.sessions.get(sessionId);
        const player = session?.match.players.find((candidate) => candidate.id === playerId);
        if (!canUseDebugTeleport(session, player, playerId)) {
            return false;
        }

        if (!isDebugTeleportDestinationAvailable(session.match, playerId, position)) {
            return false;
        }

        session.match = {
            ...session.match,
            players: session.match.players.map((candidate) =>
                candidate.id === playerId
                    ? {
                        ...candidate,
                        position: { ...position },
                        render: applyFacingTowardPosition(candidate, position).render,
                    }
                    : candidate,
            ),
        };
        this.emitSnapshot(session);
        return true;
    }

    addChatMessage(sessionId: string, message: ChatMessage): ChatMessage | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        session.messages.push(message);
        this.emitSnapshot(session);
        return message;
    }

    movePlayer(sessionId: string, playerId: string, direction: 'up' | 'down' | 'left' | 'right'): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.match.pendingSanctuaryChoice) {
            return false;
        }

        const movingPlayer = session.match.players.find((player) => player.id === playerId);
        if (!movingPlayer) {
            return false;
        }

        const destination = getGameSessionDestination(movingPlayer.position, direction);
        const cost = getGameSessionMovementCost(session.match, destination, playerId);
        if (cost === null || cost > session.turnState.movementPointsRemaining) {
            return false;
        }

        const nextPlayers = session.match.players.map((player) =>
            player.id === playerId
                ? {
                    ...player,
                    position: { ...destination },
                    render: setTransientPose(
                        applyFacingTowardPosition(player, destination),
                        PlayerPose.Walk,
                        WALK_POSE_DURATION_MS,
                    ).render,
                }
                : player,
        );
        session.match = {
            ...session.match,
            players: nextPlayers,
            objects: buildGameSessionVisibleObjects(session.match.allObjects, nextPlayers),
        };
        session.turnState = {
            ...session.turnState,
            movementPointsRemaining: session.turnState.movementPointsRemaining - cost,
            movementCount: session.turnState.movementCount + 1,
        };
        this.emitSnapshot(session);
        return true;
    }

    useSanctuary(sessionId: string, playerId: string, sanctuaryId: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.turnState.actionTaken ||
            session.match.endState) {
            return false;
        }

        const pendingSanctuaryChoice = beginGameSessionSanctuaryChoice(session.match, playerId, sanctuaryId);
        if (!pendingSanctuaryChoice) {
            return false;
        }

        session.match = {
            ...session.match,
            pendingSanctuaryChoice,
        };
        this.emitSnapshot(session);
        return true;
    }

    resolveSanctuaryChoice(sessionId: string, playerId: string, choice: MatchSanctuaryChoice): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.match.endState ||
            session.match.pendingSanctuaryChoice?.playerId !== playerId) {
            return false;
        }

        const resolution = resolveGameSessionSanctuaryChoice(session.match, choice, Math.random);
        if (!resolution) {
            return false;
        }

        session.match = resolution.nextMatch;
        if (resolution.actionConsumed) {
            session.turnState = {
                ...session.turnState,
                actionTaken: true,
            };
        }

        this.emitSnapshot(session);
        return true;
    }

    toggleDoor(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        const actionContext = this.getDoorToggleContext(sessionId, playerId, position);
        if (!actionContext) {
            return false;
        }

        const { session, player } = actionContext;
        const nextMap = session.match.map.map((cell) =>
            cell.position.x === position.x && cell.position.y === position.y
                ? { ...cell, isWalkable: !cell.isWalkable }
                : cell,
        );

        session.match = {
            ...session.match,
            players: session.match.players.map((candidate) =>
                candidate.id === playerId
                    ? {
                        ...candidate,
                        render: setTransientPose(
                            applyFacingTowardPosition(player, position),
                            PlayerPose.Attack,
                            ATTACK_POSE_DURATION_MS,
                        ).render,
                    }
                    : candidate,
            ),
            map: nextMap,
        };
        session.turnState = { ...session.turnState, actionTaken: true };
        this.emitSnapshot(session);
        return true;
    }

    startCombat(sessionId: string, attackerId: string, defenderId: string): boolean {
        const combatContext = this.getCombatContext(sessionId, attackerId, defenderId);
        if (!combatContext) {
            return false;
        }

        const { session, attacker, defender } = combatContext;
        const respawnPosition = resolveRespawnPosition(session.match, defenderId);
        const nextPlayers = session.match.players.map((player) => {
            if (player.id === attackerId) {
                return {
                    ...player,
                    combatWins: player.combatWins + 1,
                    render: setTransientPose(
                        applyFacingTowardPosition(player, defender.position),
                        PlayerPose.Attack,
                        ATTACK_POSE_DURATION_MS,
                    ).render,
                };
            }

            if (player.id === defenderId) {
                return { ...player, position: { ...respawnPosition } };
            }

            return player;
        });
        const winner = nextPlayers.find((player) => player.id === attackerId) ?? attacker;

        session.match = {
            ...session.match,
            players: nextPlayers,
            objects: buildGameSessionVisibleObjects(session.match.allObjects, nextPlayers),
            endState: winner.combatWins >= CLASSIC_WIN_THRESHOLD ? {
                id: crypto.randomUUID(),
                winnerKind: 'player',
                winnerPlayerId: winner.id,
                message: `${winner.name} remporte la partie avec ${winner.combatWins} victoires de combat.`,
                resolvedAt: Date.now(),
            } : session.match.endState ?? null,
        };
        session.turnState = {
            ...session.turnState,
            actionTaken: true,
        };

        if (session.match.endState) {
            this.finishMatch(session);
            return true;
        }

        this.emitSnapshot(session);
        return true;
    }

    private startTransition(session: GameSessionRuntime): void {
        clearGameSessionTimers(session);
        session.turnState = createTransitionTurnState(session.turnState);
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => tickGameSessionTimers(session, (candidate) => this.emitSnapshot(candidate)), SNAPSHOT_TICK_MS);
        session.transitionTimeoutId = setTimeout(() => this.activateTurn(session), TRANSITION_DURATION_MS);
    }

    private activateTurn(session: GameSessionRuntime): void {
        const activePlayerId = session.turnState.order[session.turnState.currentTurnIndex]?.playerId ?? null;
        const activePlayer = session.match.players.find((player) => player.id === activePlayerId) ?? null;
        if (!activePlayerId || !activePlayer) {
            return;
        }

        clearGameSessionTimers(session);
        session.turnState = createActiveTurnState(session.turnState, activePlayer);
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => tickGameSessionTimers(session, (candidate) => this.emitSnapshot(candidate)), SNAPSHOT_TICK_MS);
        session.activeTurnTimeoutId = setTimeout(() => this.advanceToNextTurn(session), ACTIVE_TURN_DURATION_MS);
    }

    private advanceToNextTurn(session: GameSessionRuntime): void {
        clearGameSessionTimers(session);
        if (session.turnState.order.length === 0) {
            return;
        }

        session.match = progressGameSessionSanctuaryEffects(session.match, session.turnState.activePlayerId);
        session.turnState = {
            ...session.turnState,
            currentTurnIndex: (session.turnState.currentTurnIndex + 1) % session.turnState.order.length,
        };
        this.startTransition(session);
    }

    private finishMatch(session: GameSessionRuntime): void {
        clearGameSessionTimers(session);
        session.turnState = {
            ...session.turnState,
            phase: 'transition',
            activePlayerId: null,
            transitionTargetPlayerId: null,
            transitionEndsAt: null,
            transitionRemainingMs: 0,
            activeTurnEndsAt: null,
            activeTurnRemainingMs: 0,
            movementPointsRemaining: 0,
            actionTaken: true,
            playerStates: session.turnState.playerStates.map((playerState) => ({ ...playerState, state: 'waiting' })),
        };
        session.match = {
            ...session.match,
            pendingSanctuaryChoice: null,
        };
        this.emitSnapshot(session);
        this.sessions.delete(session.sessionId);
    }

    private emitSnapshot(session: GameSessionRuntime): void {
        this.events.emit(SessionSocketEvents.GameSessionSnapshot, {
            sessionId: session.sessionId,
            match: session.match,
            turnState: session.turnState,
            messages: session.messages,
        });
    }

    private getDoorToggleContext(
        sessionId: string,
        playerId: string,
        position: { x: number; y: number },
    ): { session: GameSessionRuntime; player: MatchPlayer } | null {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.turnState.actionTaken ||
            session.match.pendingSanctuaryChoice ||
            session.match.endState) {
            return null;
        }

        const player = session.match.players.find((candidate) => candidate.id === playerId);
        if (!player) {
            return null;
        }

        const adjacent = Math.abs(player.position.x - position.x) + Math.abs(player.position.y - position.y) === 1;
        if (!adjacent) {
            return null;
        }

        const doorCell = session.match.map.find(
            (cell) => cell.tileType === TileType.DOOR && cell.position.x === position.x && cell.position.y === position.y,
        );
        if (!doorCell) {
            return null;
        }

        const playerOnDoor = session.match.players.some(
            (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
        );
        const flagOnDoor = session.match.mode === GameMode.CTF && session.match.objects.some(
            (object) => object.type === ObjectType.FLAG && object.position.x === position.x && object.position.y === position.y,
        );
        if ((playerOnDoor || flagOnDoor) && doorCell.isWalkable) {
            return null;
        }

        return { session, player };
    }

    private getCombatContext(
        sessionId: string,
        attackerId: string,
        defenderId: string,
    ): { session: GameSessionRuntime; attacker: MatchPlayer; defender: MatchPlayer } | null {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== attackerId ||
            session.turnState.actionTaken ||
            session.match.pendingSanctuaryChoice ||
            session.match.endState) {
            return null;
        }

        const attacker = session.match.players.find((player) => player.id === attackerId);
        const defender = session.match.players.find((player) => player.id === defenderId);
        if (!attacker || !defender || !canStartCombat(attacker, defender)) {
            return null;
        }

        return { session, attacker, defender };
    }
}
