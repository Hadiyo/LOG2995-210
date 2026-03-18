import { MapService } from '@app/services/map/map.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { buildTurnOrderFromPlayers } from '@app/services/game-session/game-session.turn';
import { MatchTurnState } from '@common/game/turn.interface';
import { TileType } from '@common/maps/map.enums';
import { EditorMapDetails, Vec2 } from '@common/maps/map.interface';
import { SocketEvents } from '@common/socket-events';
import { EventEmitter } from 'events';
import {
    buildGameSessionVisibleObjects,
    buildInitializedMatchFromEditor,
    getGameSessionDestination,
    getGameSessionMovementCost,
} from './game-session.match';

const TRANSITION_DURATION_MS = 3000;
const ACTIVE_TURN_DURATION_MS = 30000;
const SNAPSHOT_TICK_MS = 1000;
const CLASSIC_WIN_THRESHOLD = 3;

interface GameSessionRuntime {
    sessionId: string;
    match: InitializedMatch;
    turnState: MatchTurnState;
    socketToPlayerId: Map<string, string>;
    transitionTimeoutId: NodeJS.Timeout | null;
    activeTurnTimeoutId: NodeJS.Timeout | null;
    timerIntervalId: NodeJS.Timeout | null;
}
@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionRuntime>();
    private readonly events = new EventEmitter();
    constructor(private readonly mapService: MapService) {}

    public on<T>(event: SocketEvents, callback: (payload: T) => void): void {
        this.events.on(event, callback);
    }

    public off<T>(event: SocketEvents, callback: (payload: T) => void): void {
        this.events.off(event, callback);
    }

    public async createSessionFromWaitingRoom(mapId: string, players: MatchLobbyPlayer[]): Promise<string> {
        const map = await this.mapService.getMapByIdForEditor(mapId);
        const session = this.buildSession(map, players);
        this.sessions.set(session.sessionId, session);
        this.emitSnapshot(session);
        this.startTransition(session);
        return session.sessionId;
    }

    public registerSocket(sessionId: string, playerId: string, socketId: string): { match: InitializedMatch; turnState: MatchTurnState } {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new NotFoundException('Game session not found');
        }

        session.socketToPlayerId.set(socketId, playerId);
        return { match: session.match, turnState: session.turnState };
    }

    public getPlayerIdForSocket(socketId: string, sessionId: string): string | null {
        return this.sessions.get(sessionId)?.socketToPlayerId.get(socketId) ?? null;
    }

    public getPlayerNameForSocket(socketId: string, sessionId: string): string | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const playerId = session.socketToPlayerId.get(socketId);
        return session.match.players.find((player) => player.id === playerId)?.name ?? null;
    }

    public findSessionIdForSocket(socketId: string): string | null {
        for (const session of this.sessions.values()) {
            if (session.socketToPlayerId.has(socketId)) {
                return session.sessionId;
            }
        }

        return null;
    }

    public removeSocket(socketId: string): { sessionId: string; playerId: string } | null {
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

    public endTurn(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session || session.turnState.phase !== 'active' || session.turnState.activePlayerId !== playerId) {
            return false;
        }

        this.advanceToNextTurn(session);
        return true;
    }

    public surrender(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        const nextPlayers = session.match.players.filter((player) => player.id !== playerId);
        if (nextPlayers.length === session.match.players.length) {
            return false;
        }

        session.match = {
            ...session.match,
            players: nextPlayers,
            objects: buildGameSessionVisibleObjects(session.match.allObjects, nextPlayers),
        };

        if (nextPlayers.length === 0) {
            this.clearTimers(session);
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
            session.turnState = this.rebuildTurnStateAfterRosterChange(session.turnState, nextPlayers);
            this.startTransition(session);
            return true;
        }

        session.turnState = this.rebuildTurnStateAfterRosterChange(session.turnState, nextPlayers);
        this.emitSnapshot(session);
        return true;
    }

    public movePlayer(sessionId: string, playerId: string, direction: 'up' | 'down' | 'left' | 'right'): boolean {
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
            player.id === playerId ? { ...player, position: { ...destination } } : player,
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

    public toggleDoor(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
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
        if (playerOnDoor && doorCell.isWalkable) {
            return false;
        }

        const nextMap = session.match.map.map((cell) =>
            cell.position.x === position.x && cell.position.y === position.y
                ? { ...cell, isWalkable: !cell.isWalkable }
                : cell,
        );

        session.match = {
            ...session.match,
            map: nextMap,
        };
        session.turnState = { ...session.turnState, actionTaken: true };
        this.emitSnapshot(session);
        return true;
    }

    public startCombat(sessionId: string, attackerId: string, defenderId: string): boolean {
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
        if (!attacker || !defender || !this.canStartCombat(attacker, defender)) {
            return false;
        }

        const respawnPosition = this.resolveRespawnPosition(session.match, defenderId);
        const nextPlayers = session.match.players.map((player) => {
            if (player.id === attackerId) {
                return { ...player, combatWins: player.combatWins + 1 };
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

    private buildSession(map: EditorMapDetails, players: MatchLobbyPlayer[]): GameSessionRuntime {
        const sessionId = crypto.randomUUID();
        const match = buildInitializedMatchFromEditor(map, players, Math.random);
        const order = buildTurnOrderFromPlayers(match.players, Math.random);
        const firstPlayerId = order[0]?.playerId ?? null;
        const turnState: MatchTurnState = {
            matchId: match.mapId,
            hasStarted: false,
            order,
            currentTurnIndex: 0,
            phase: 'transition',
            activePlayerId: null,
            transitionTargetPlayerId: firstPlayerId,
            transitionEndsAt: Date.now() + TRANSITION_DURATION_MS,
            transitionRemainingMs: TRANSITION_DURATION_MS,
            activeTurnEndsAt: null,
            activeTurnRemainingMs: 0,
            movementPointsRemaining: 0,
            actionTaken: false,
            movementCount: 0,
            playerStates: order.map((entry) => ({ playerId: entry.playerId, state: 'waiting' })),
        };

        return {
            sessionId,
            match,
            turnState,
            socketToPlayerId: new Map(),
            transitionTimeoutId: null,
            activeTurnTimeoutId: null,
            timerIntervalId: null,
        };
    }

    private startTransition(session: GameSessionRuntime): void {
        this.clearTimers(session);
        session.turnState = {
            ...session.turnState,
            phase: 'transition',
            hasStarted: session.turnState.hasStarted,
            activePlayerId: null,
            transitionTargetPlayerId: session.turnState.order[session.turnState.currentTurnIndex]?.playerId ?? null,
            transitionEndsAt: Date.now() + TRANSITION_DURATION_MS,
            transitionRemainingMs: TRANSITION_DURATION_MS,
            activeTurnEndsAt: null,
            activeTurnRemainingMs: 0,
            movementPointsRemaining: 0,
            actionTaken: false,
            movementCount: 0,
            playerStates: session.turnState.order.map((entry) => ({ playerId: entry.playerId, state: 'waiting' })),
        };
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
        session.turnState = {
            ...session.turnState,
            hasStarted: true,
            phase: 'active',
            activePlayerId,
            transitionTargetPlayerId: null,
            transitionEndsAt: null,
            transitionRemainingMs: 0,
            activeTurnEndsAt: Date.now() + ACTIVE_TURN_DURATION_MS,
            activeTurnRemainingMs: ACTIVE_TURN_DURATION_MS,
            movementPointsRemaining: activePlayer.speed,
            actionTaken: false,
            movementCount: 0,
            playerStates: session.turnState.order.map((entry) => ({
                playerId: entry.playerId,
                state: entry.playerId === activePlayerId ? 'active' : 'waiting',
            })),
        };
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => this.tickTimers(session), SNAPSHOT_TICK_MS);
        session.activeTurnTimeoutId = setTimeout(() => this.advanceToNextTurn(session), ACTIVE_TURN_DURATION_MS);
    }

    private advanceToNextTurn(session: GameSessionRuntime): void {
        this.clearTimers(session);
        if (session.turnState.order.length === 0) {
            return;
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

    private canStartCombat(attacker: MatchPlayer, defender: MatchPlayer): boolean {
        return Math.abs(attacker.position.x - defender.position.x) + Math.abs(attacker.position.y - defender.position.y) === 1;
    }

    private resolveRespawnPosition(match: InitializedMatch, defeatedPlayerId: string): Vec2 {
        const defeatedPlayer = match.players.find((player) => player.id === defeatedPlayerId);
        if (!defeatedPlayer) {
            return { x: 0, y: 0 };
        }

        const occupiedKeys = new Set(
            match.players
                .filter((player) => player.id !== defeatedPlayerId)
                .map((player) => `${player.position.x}:${player.position.y}`),
        );

        const origin = defeatedPlayer.startingPosition;

        const isFree = (pos: Vec2): boolean => !occupiedKeys.has(`${pos.x}:${pos.y}`);

        if (isFree(origin)) {
            return { ...origin };
        }

        const candidates = match.map
            .filter((cell) => cell.tileType !== TileType.WALL && cell.tileType !== TileType.DOOR && isFree(cell.position))
            .sort((left, right) => {
                const distanceDelta =
                    (Math.abs(left.position.x - origin.x) + Math.abs(left.position.y - origin.y)) -
                    (Math.abs(right.position.x - origin.x) + Math.abs(right.position.y - origin.y));
                if (distanceDelta !== 0) return distanceDelta;
                if (left.position.y !== right.position.y) return left.position.y - right.position.y;
                return left.position.x - right.position.x;
            });

        return candidates[0] ? { ...candidates[0].position } : { ...origin };
    }

    private rebuildTurnStateAfterRosterChange(current: MatchTurnState, players: MatchPlayer[]): MatchTurnState {
        const playerIds = new Set(players.map((player) => player.id));
        const order = current.order.filter((entry) => playerIds.has(entry.playerId));
        const removedBeforeCurrent = current.order
            .slice(0, current.currentTurnIndex)
            .filter((entry) => !playerIds.has(entry.playerId)).length;
        const currentTurnIndex = order.length === 0 ? 0 : (current.currentTurnIndex - removedBeforeCurrent) % order.length;
        const activePlayerId = order[currentTurnIndex]?.playerId ?? null;
        return {
            ...current,
            order,
            currentTurnIndex,
            activePlayerId,
            transitionTargetPlayerId: current.phase === 'transition' ? activePlayerId : null,
            playerStates: order.map((entry) => ({
                playerId: entry.playerId,
                state: current.phase === 'active' && entry.playerId === activePlayerId ? 'active' : 'waiting',
            })),
        };
    }

    private emitSnapshot(session: GameSessionRuntime): void {
        this.events.emit(SocketEvents.GameSessionSnapshot, {
            sessionId: session.sessionId,
            match: session.match,
            turnState: session.turnState,
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

}
