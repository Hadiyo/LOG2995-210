/* eslint-disable max-lines */
import { ChatMessage } from '@common/chat/chat.interface';
import { MapService } from '@app/services/map/map.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InitializedMatch, MatchLobbyPlayer, MatchPendingFlagTransfer, MatchPlayer, MatchTeamId } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { SocketEvents } from '@common/socket-events';
import { PlayerRenderState } from '@common/player/player.interface';
import { EventEmitter } from 'events';
import {
    buildVisibleObjects,
    createGameSessionInitialRenderState,
    getGameSessionDestination,
    getGameSessionFacingToTarget,
    getGameSessionMovementCost,
    getGameSessionObjectCovering,
    resolveFlagCarrier,
} from './game-session.match';
import {
    ACTIVE_TURN_DURATION_MS,
    buildSession,
    CLASSIC_WIN_THRESHOLD,
    createActiveTurnState,
    createTransitionTurnState,
    GameSessionRuntime,
    rebuildTurnStateAfterRosterChange,
    resolveRespawnPosition,
    SNAPSHOT_TICK_MS,
    TRANSITION_DURATION_MS,
} from './game-session.runtime';

const WALK_POSE_DURATION_MS = 180;
const ATTACK_POSE_DURATION_MS = 220;
@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionRuntime>();
    private readonly events = new EventEmitter();
    constructor(private readonly mapService: MapService) {}

    on<T>(event: SocketEvents, callback: (payload: T) => void): void {
        this.events.on(event, callback);
    }

    off<T>(event: SocketEvents, callback: (payload: T) => void): void {
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

        this.clearTimers(session);
        this.sessions.delete(sessionId);
    }

    endTurn(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.turnState.phase !== 'active' || session.turnState.activePlayerId !== playerId) {
            return false;
        }

        this.advanceToNextTurn(session);
        return true;
    }

    requestFlagTransfer(sessionId: string, requesterId: string, receiverId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== requesterId ||
            session.turnState.actionTaken ||
            session.match.endState) {
            return false;
        }

        const pendingFlagTransfer = this.createPendingFlagTransfer(session.match, requesterId, receiverId);
        if (!pendingFlagTransfer) {
            return false;
        }

        session.match = {
            ...session.match,
            pendingFlagTransfer,
        };
        session.turnState = {
            ...session.turnState,
            actionTaken: true,
        };
        this.emitSnapshot(session);
        return true;
    }

    resolveFlagTransfer(sessionId: string, receiverId: string, accepted: boolean): boolean {
        const session = this.sessions.get(sessionId);
        const pendingFlagTransfer = session?.match.pendingFlagTransfer ?? null;
        if (!this.canResolveFlagTransfer(session, pendingFlagTransfer, receiverId)) {
            return false;
        }

        const nextFlagCarrierId = this.resolveTransferredFlagCarrierId(session.match, pendingFlagTransfer, accepted);
        session.match = {
            ...session.match,
            flagCarrierId: nextFlagCarrierId,
            pendingFlagTransfer: null,
            objects: buildVisibleObjects(session.match.allObjects, session.match.players, nextFlagCarrierId),
        };

        if (accepted) {
            const transferMessage = this.buildFlagTransferMessage(session.match, pendingFlagTransfer, nextFlagCarrierId);
            if (transferMessage) {
                session.messages.push(this.createSystemMessage(transferMessage));
            }
        }

        if (this.finishCtfMatchIfFlagTransferWins(session, accepted, nextFlagCarrierId)) {
            return true;
        }

        this.emitSnapshot(session);
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

        const nextFlagCarrierId = session.match.flagCarrierId === playerId ? null : (session.match.flagCarrierId ?? null);
        const nextPendingFlagTransfer = this.clearPendingFlagTransfer(session.match.pendingFlagTransfer ?? null, playerId);
        const nextAllObjects = session.match.allObjects.map((object) =>
            session.match.flagCarrierId === playerId && object.type === ObjectType.FLAG && departingPlayer
                ? { ...object, position: { ...departingPlayer.position } }
                : { ...object, position: { ...object.position } },
        );

        session.match = {
            ...session.match,
            debugMode: organizerLeftWhileDebugEnabled ? false : session.match.debugMode,
            players: nextPlayers,
            allObjects: nextAllObjects,
            flagCarrierId: nextFlagCarrierId,
            pendingFlagTransfer: nextPendingFlagTransfer,
            objects: buildVisibleObjects(
                nextAllObjects,
                nextPlayers,
                nextFlagCarrierId,
            ),
        };

        if (nextPlayers.length === 0) {
            this.clearTimers(session);
            this.sessions.delete(sessionId);
            return true;
        }

        const missingTeamId = this.getMissingCtfTeamId(session.match.mode, nextPlayers);
        if (missingTeamId) {
            session.match = {
                ...session.match,
                endState: {
                    id: crypto.randomUUID(),
                    winnerKind: 'none',
                    winnerPlayerId: null,
                    winnerTeamId: null,
                    message: `La partie est annulee: l equipe ${missingTeamId} n'a plus aucun joueur suite a des abandons.`,
                    resolvedAt: Date.now(),
                },
            };
            this.finishMatch(session);
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
                    winnerTeamId: null,
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
        if (!session ||
            !player ||
            !player.isOrganizer ||
            !session.match.debugMode ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.match.endState) {
            return false;
        }

        const targetCell = session.match.map.find(
            (cell) => cell.position.x === position.x && cell.position.y === position.y,
        );
        if (!targetCell || targetCell.tileType === TileType.WALL || (targetCell.tileType === TileType.DOOR && !targetCell.isWalkable)) {
            return false;
        }

        const occupiedByPlayer = session.match.players.some(
            (candidate) => candidate.id !== playerId && candidate.position.x === position.x && candidate.position.y === position.y,
        );
        if (occupiedByPlayer) {
            return false;
        }

        const occupiedByObject = !!getGameSessionObjectCovering(session.match.objects, position);
        if (occupiedByObject) {
            return false;
        }

        session.match = {
            ...session.match,
            players: session.match.players.map((candidate) =>
                candidate.id === playerId
                    ? {
                        ...candidate,
                        position: { ...position },
                        render: this.applyFacingTowardPosition(candidate, position).render,
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
        if (!session || session.turnState.phase !== 'active' || session.turnState.activePlayerId !== playerId) {
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
                    render: this.setTransientPose(
                        this.applyFacingTowardPosition(player, destination),
                        'walk',
                        WALK_POSE_DURATION_MS,
                    ).render,
                }
                : player,
        );
        const nextFlagCarrierId = resolveFlagCarrier(session.match, playerId, destination);
        const pickedUpFlag = session.match.flagCarrierId === null && nextFlagCarrierId === playerId;
        session.match = {
            ...session.match,
            players: nextPlayers,
            flagCarrierId: nextFlagCarrierId,
            objects: buildVisibleObjects(session.match.allObjects, nextPlayers, nextFlagCarrierId),
        };
        if (pickedUpFlag) {
            session.messages.push(this.createSystemMessage(`${movingPlayer.name} ramasse le drapeau.`));
        }
        session.turnState = {
            ...session.turnState,
            movementPointsRemaining: session.turnState.movementPointsRemaining - cost,
            movementCount: session.turnState.movementCount + 1,
        };

        if (this.isCtfWinner(session.match, playerId)) {
            const winner = session.match.players.find((player) => player.id === playerId) ?? movingPlayer;
            session.match = {
                ...session.match,
                endState: {
                    id: crypto.randomUUID(),
                    winnerKind: 'team',
                    winnerPlayerId: winner.id,
                    winnerTeamId: winner.teamId ?? null,
                    message: `L equipe ${winner.teamId ?? '?'} remporte la partie: ${winner.name} ramene le drapeau a son point de depart.`,
                    resolvedAt: Date.now(),
                },
            };
            this.finishMatch(session);
            return true;
        }

        this.emitSnapshot(session);
        return true;
    }

    toggleDoor(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.turnState.actionTaken ||
            session.match.endState) {
            return false;
        }

        const player = session.match.players.find((candidate) => candidate.id === playerId);
        if (!player) {
            return false;
        }

        const adjacent = Math.abs(player.position.x - position.x) + Math.abs(player.position.y - position.y) === 1;
        if (!adjacent) {
            return false;
        }

        const doorCell = session.match.map.find(
            (cell) => cell.tileType === TileType.DOOR && cell.position.x === position.x && cell.position.y === position.y,
        );
        if (!doorCell) {
            return false;
        }

        const playerOnDoor = session.match.players.some(
            (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
        );
        const flagOnDoor = session.match.mode === GameMode.CTF && session.match.objects.some(
            (object) => object.type === ObjectType.FLAG && object.position.x === position.x && object.position.y === position.y,
        );
        if ((playerOnDoor || flagOnDoor) && doorCell.isWalkable) {
            return false;
        }

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
                        render: this.setTransientPose(
                            this.applyFacingTowardPosition(candidate, position),
                            'attack',
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
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== attackerId ||
            session.turnState.actionTaken ||
            session.match.endState) {
            return false;
        }

        const attacker = session.match.players.find((player) => player.id === attackerId);
        const defender = session.match.players.find((player) => player.id === defenderId);
        if (!attacker || !defender || !this.canStartCombat(session.match, attacker, defender)) {
            return false;
        }

        const respawnPosition = resolveRespawnPosition(session.match, defenderId);
        let nextFlagCarrierId = session.match.flagCarrierId ?? null;
        let nextAllObjects = session.match.allObjects.map((object) => ({
            ...object,
            position: { ...object.position },
        }));
        const nextPlayers = session.match.players.map((player) => {
            if (player.id === attackerId) {
                return {
                    ...player,
                    combatWins: player.combatWins + 1,
                    render: this.setTransientPose(
                        this.applyFacingTowardPosition(player, defender.position),
                        'attack',
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

        if (session.match.flagCarrierId === defenderId) {
            nextFlagCarrierId = null;
            nextAllObjects = nextAllObjects.map((object) =>
                object.type === ObjectType.FLAG
                    ? { ...object, position: { ...defender.position } }
                    : object,
            );
        }

        session.match = {
            ...session.match,
            players: nextPlayers,
            allObjects: nextAllObjects,
            flagCarrierId: nextFlagCarrierId,
            objects: buildVisibleObjects(nextAllObjects, nextPlayers, nextFlagCarrierId),
            endState: winner.combatWins >= CLASSIC_WIN_THRESHOLD ? {
                id: crypto.randomUUID(),
                winnerKind: 'player',
                winnerPlayerId: winner.id,
                winnerTeamId: null,
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
        this.clearTimers(session);
        session.turnState = createTransitionTurnState(session.turnState);
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => this.tickTimers(session), SNAPSHOT_TICK_MS);
        session.transitionTimeoutId = setTimeout(() => this.activateTurn(session), TRANSITION_DURATION_MS);
    }

    private activateTurn(session: GameSessionRuntime): void {
        const activePlayerId = session.turnState.order[session.turnState.currentTurnIndex]?.playerId ?? null;
        const activePlayer = session.match.players.find((player) => player.id === activePlayerId) ?? null;
        if (!activePlayerId || !activePlayer) {
            return;
        }

        this.clearTimers(session);
        session.turnState = createActiveTurnState(session.turnState, activePlayer);
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => this.tickTimers(session), SNAPSHOT_TICK_MS);
        session.activeTurnTimeoutId = setTimeout(() => this.advanceToNextTurn(session), ACTIVE_TURN_DURATION_MS);
    }

    private advanceToNextTurn(session: GameSessionRuntime): void {
        this.clearTimers(session);
        if (session.turnState.order.length === 0) {
            return;
        }

        if (session.match.pendingFlagTransfer) {
            session.match = {
                ...session.match,
                pendingFlagTransfer: null,
            };
        }

        session.turnState = {
            ...session.turnState,
            currentTurnIndex: (session.turnState.currentTurnIndex + 1) % session.turnState.order.length,
        };
        this.startTransition(session);
    }

    private tickTimers(session: GameSessionRuntime): void {
        if (session.turnState.phase === 'transition' && session.turnState.transitionEndsAt !== null) {
            session.turnState = {
                ...session.turnState,
                transitionRemainingMs: Math.max(0, session.turnState.transitionEndsAt - Date.now()),
            };
            this.emitSnapshot(session);
            return;
        }

        if (session.turnState.phase === 'active' && session.turnState.activeTurnEndsAt !== null) {
            session.turnState = {
                ...session.turnState,
                activeTurnRemainingMs: Math.max(0, session.turnState.activeTurnEndsAt - Date.now()),
            };
            this.emitSnapshot(session);
        }
    }

    private finishMatch(session: GameSessionRuntime): void {
        this.clearTimers(session);
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
        };
        this.emitSnapshot(session);
        this.sessions.delete(session.sessionId);
    }

    private emitSnapshot(session: GameSessionRuntime): void {
        this.events.emit(SocketEvents.GameSessionSnapshot, {
            sessionId: session.sessionId,
            match: session.match,
            turnState: session.turnState,
            messages: session.messages,
        });
    }

    private clearTimers(session: GameSessionRuntime): void {
        if (session.transitionTimeoutId) {
            clearTimeout(session.transitionTimeoutId);
            session.transitionTimeoutId = null;
        }
        if (session.activeTurnTimeoutId) {
            clearTimeout(session.activeTurnTimeoutId);
            session.activeTurnTimeoutId = null;
        }
        if (session.timerIntervalId) {
            clearInterval(session.timerIntervalId);
            session.timerIntervalId = null;
        }
    }

    private applyFacingTowardPosition(player: MatchPlayer, target: { x: number; y: number }): MatchPlayer {
        const facing = getGameSessionFacingToTarget(player.position, target);
        if (!facing) {
            return player;
        }

        return {
            ...player,
            render: {
                ...createGameSessionInitialRenderState(),
                ...player.render,
                facing,
            },
        };
    }

    private setTransientPose(player: MatchPlayer, pose: 'walk' | 'attack', durationMs: number): MatchPlayer {
        return {
            ...player,
            render: {
                ...createGameSessionInitialRenderState(),
                ...player.render,
                pose,
                poseStartedAt: new Date().toISOString(),
                poseDurationMs: durationMs,
            } satisfies PlayerRenderState,
        };
    }

    private canStartCombat(match: InitializedMatch, attacker: MatchPlayer, defender: MatchPlayer): boolean {
        if (Math.abs(attacker.position.x - defender.position.x) + Math.abs(attacker.position.y - defender.position.y) !== 1) {
            return false;
        }

        return match.mode !== GameMode.CTF ||
            attacker.teamId === null ||
            attacker.teamId === undefined ||
            attacker.teamId !== defender.teamId;
    }

    private isCtfWinner(match: InitializedMatch, playerId: string): boolean {
        if (match.mode !== GameMode.CTF || match.flagCarrierId !== playerId) {
            return false;
        }

        const player = match.players.find((candidate) => candidate.id === playerId);
        return !!player &&
            player.position.x === player.startingPosition.x &&
            player.position.y === player.startingPosition.y;
    }

    private createPendingFlagTransfer(
        match: InitializedMatch,
        requesterId: string,
        receiverId: string,
    ): MatchPendingFlagTransfer | null {
        if (match.mode !== GameMode.CTF || match.pendingFlagTransfer) {
            return null;
        }

        const requester = match.players.find((player) => player.id === requesterId) ?? null;
        const receiver = match.players.find((player) => player.id === receiverId) ?? null;
        if (!requester || !receiver) {
            return null;
        }

        const sameTeam = requester.teamId !== null && requester.teamId !== undefined && requester.teamId === receiver.teamId;
        const adjacent = Math.abs(requester.position.x - receiver.position.x) + Math.abs(requester.position.y - receiver.position.y) === 1;
        if (!sameTeam || !adjacent) {
            return null;
        }

        const requesterHasFlag = match.flagCarrierId === requesterId;
        const receiverHasFlag = match.flagCarrierId === receiverId;
        if (requesterHasFlag === receiverHasFlag) {
            return null;
        }

        return {
            requesterId,
            receiverId,
            kind: requesterHasFlag ? 'offer' : 'request',
        };
    }

    private clearPendingFlagTransfer(
        pendingFlagTransfer: MatchPendingFlagTransfer | null,
        playerId: string,
    ): MatchPendingFlagTransfer | null {
        if (!pendingFlagTransfer) {
            return null;
        }

        return pendingFlagTransfer.requesterId === playerId || pendingFlagTransfer.receiverId === playerId
            ? null
            : pendingFlagTransfer;
    }

    private getMissingCtfTeamId(mode: GameMode, players: MatchPlayer[]): MatchTeamId | null {
        if (mode !== GameMode.CTF || players.length === 0) {
            return null;
        }

        const teamAAlive = players.some((player) => player.teamId === 'A');
        const teamBAlive = players.some((player) => player.teamId === 'B');
        if (teamAAlive === teamBAlive) {
            return null;
        }

        return teamAAlive ? 'B' : 'A';
    }

    private buildFlagTransferMessage(
        match: InitializedMatch,
        pendingFlagTransfer: MatchPendingFlagTransfer,
        nextFlagCarrierId: string | null,
    ): string | null {
        if (!nextFlagCarrierId) {
            return null;
        }

        const receiver = match.players.find((player) => player.id === pendingFlagTransfer.receiverId) ?? null;
        const requester = match.players.find((player) => player.id === pendingFlagTransfer.requesterId) ?? null;
        if (!receiver || !requester) {
            return null;
        }

        const giver = nextFlagCarrierId === receiver.id ? requester : receiver;
        const beneficiary = nextFlagCarrierId === receiver.id ? receiver : requester;
        return `${beneficiary.name} obtient le drapeau de ${giver.name}.`;
    }

    private canResolveFlagTransfer(
        session: GameSessionRuntime | undefined,
        pendingFlagTransfer: MatchPendingFlagTransfer | null,
        receiverId: string,
    ): session is GameSessionRuntime {
        return !!session &&
            !!pendingFlagTransfer &&
            pendingFlagTransfer.receiverId === receiverId &&
            !session.match.endState;
    }

    private resolveTransferredFlagCarrierId(
        match: InitializedMatch,
        pendingFlagTransfer: MatchPendingFlagTransfer,
        accepted: boolean,
    ): string | null {
        if (!accepted) {
            return match.flagCarrierId ?? null;
        }

        return pendingFlagTransfer.kind === 'offer'
            ? pendingFlagTransfer.receiverId
            : pendingFlagTransfer.requesterId;
    }

    private finishCtfMatchIfFlagTransferWins(
        session: GameSessionRuntime,
        accepted: boolean,
        nextFlagCarrierId: string | null,
    ): boolean {
        if (!accepted || !nextFlagCarrierId || !this.isCtfWinner(session.match, nextFlagCarrierId)) {
            return false;
        }

        const winner = session.match.players.find((player) => player.id === nextFlagCarrierId) ?? null;
        if (!winner) {
            return false;
        }

        session.match = {
            ...session.match,
            endState: {
                id: crypto.randomUUID(),
                winnerKind: 'team',
                winnerPlayerId: winner.id,
                winnerTeamId: winner.teamId ?? null,
                message: `L equipe ${winner.teamId ?? '?'} remporte la partie: ${winner.name} ramene le drapeau a son point de depart.`,
                resolvedAt: Date.now(),
            },
        };
        this.finishMatch(session);
        return true;
    }

    private createSystemMessage(content: string): ChatMessage {
        return {
            id: crypto.randomUUID(),
            author: 'Journal',
            content,
            createdAt: new Date().toISOString(),
        };
    }
}
