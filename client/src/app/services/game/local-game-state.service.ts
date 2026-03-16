import { Injectable, computed, signal } from '@angular/core';
import { ChatMessage } from '@common/chat-message';
import { GameNotificationKind } from '@common/game-notification';
import { GameSessionSnapshot, TurnPhase } from '@common/game-session';
import { GameActionType } from '@common/game/game-session.interface';
import { TileType } from '@common/maps/map.enums';
import { GameCell } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';
import { Observable, of, throwError } from 'rxjs';
import {
    applyDebugTeleportInSession,
    canForceEndTurnInDebugMode,
    disableDebugModeIfOrganizerLeaves,
    toggleDebugModeInSession,
} from './debug/game-debug.utils';
import { GameNotificationStateService } from './game-notification-state.service';
import { applyRuntimePlayerDefaults, assignInitialPositions, toGameMapState } from './local/local-game-map.utils';
import * as localGameRuntimeUtils from './local/local-game-runtime.utils';
import { cloneSession, generateLocalId, persistSessions, restoreSessions } from './local/local-game-storage.utils';
import * as localGameConstants from './local/local-game.constants';
import { CreateLocalSessionParams } from './local/local-game.types';
export { GAME_STORAGE_KEYS } from './local/local-game.constants';

//---------------------------------------------------------------------
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// Local game state management service for static/demo session runtime.
// To be replaced by backend-driven GameStateService in real multiplayer runtime.
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//-------------------------------------------------------------------------------    

@Injectable({
    providedIn: 'root',
})
export class LocalGameStateService {
    // Local source of truth for static/demo game session runtime.
    private readonly sessionSignal = signal<GameSessionSnapshot | null>(null);
    readonly session = this.sessionSignal.asReadonly();
    readonly hasSession = computed(() => this.sessionSignal() !== null);
    readonly activeNotification = this.gameNotificationStateService.activeNotification;

    private readonly currentSessionIdSignal = signal<string | null>(null);
    readonly currentSessionId = this.currentSessionIdSignal.asReadonly();
    private readonly currentPlayerIdSignal = signal<string | null>(null);
    readonly currentPlayerId = this.currentPlayerIdSignal.asReadonly();

    // Local in-browser sessions for static mode only.
    private readonly sessions = restoreSessions();
    private turnTimerId: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly gameNotificationStateService: GameNotificationStateService) {}

    // Local session bootstrap used by dev launcher.
    // Replace with backend createSession API + snapshot fetch for real runtime.
    createLocalSession(params: CreateLocalSessionParams): GameSessionSnapshot {
        const nowIso = new Date().toISOString();
        const sessionId = generateLocalId();
        const totalSeconds = params.turnDurationSeconds ?? localGameConstants.DEFAULT_TURN_DURATION_SECONDS;
        const gameMap = toGameMapState(params.map);
        const players = assignInitialPositions(applyRuntimePlayerDefaults(params.players), gameMap);
        const activePlayerId = players.find((player) => player.state.status === PlayerStatus.Active)?.id ?? '';

        const snapshot: GameSessionSnapshot = {
            id: sessionId,
            map: gameMap,
            players,
            turn: {
                order: players.map((player) => player.id),
                activePlayerId,
                turnNumber: 1,
                remainingSeconds: totalSeconds,
                totalSeconds,
                phase: TurnPhase.Turn,
            },
            messages: [],
            debugMode: params.debugMode ?? false,
            createdAt: nowIso,
        };

        this.sessions.set(snapshot.id, snapshot);
        persistSessions(this.sessions);
        return cloneSession(snapshot);
    }

    // Local lookup helper used to resume a previous local session.
    getLocalSessionSnapshot(sessionId: string): GameSessionSnapshot | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return cloneSession(session);
    }

    // Static-mode load path.
    // In real multiplayer mode this should switch to API+socket bootstrap.
    loadSession(sessionId: string, playerId: string): Observable<GameSessionSnapshot> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return throwError(() => new Error('Game session not found'));
        }

        const isKnownPlayer = session.players.some((player) => player.id === playerId);
        if (!isKnownPlayer) {
            return throwError(() => new Error('Player not found in this session'));
        }

        this.currentSessionIdSignal.set(sessionId);
        this.currentPlayerIdSignal.set(playerId);

        sessionStorage.setItem(localGameConstants.GAME_STORAGE_KEYS.sessionId, sessionId);
        sessionStorage.setItem(localGameConstants.GAME_STORAGE_KEYS.playerId, playerId);

        this.sessionSignal.set(cloneSession(session));
        this.startTurnTimer(sessionId);
        return of(cloneSession(session));
    }

    leaveCurrentSession(): void {
        this.stopTurnTimer();
        this.currentSessionIdSignal.set(null);
        this.currentPlayerIdSignal.set(null);
        this.sessionSignal.set(null);
        this.gameNotificationStateService.clear();
    }

    // Local simulation of end turn.
    endTurn(): void {
        const session = this.getMutableCurrentSession();
        const currentPlayerId = this.currentPlayerIdSignal();
        if (!session || !currentPlayerId) return;
        if (session.turn.activePlayerId !== currentPlayerId) return;

        this.advanceTurn(session, 'EARLY');
        this.publishSession(session);
    }

    // Allow the organizer to end the active turn while debug mode is enabled.
    forceEndTurnInDebugMode(): void {
        const session = this.getMutableCurrentSession();
        const currentPlayerId = this.currentPlayerIdSignal();
        if (!canForceEndTurnInDebugMode(session, currentPlayerId)) return;
        if (!session) return;

        this.advanceTurn(session, 'EARLY');
        this.publishSession(session);
    }

    // Toggle the shared debug flag in the local session snapshot.
    toggleDebugMode(): void {
        const session = this.getMutableCurrentSession();
        const currentPlayerId = this.currentPlayerIdSignal();
        // Apply the debug toggle through the shared utility to keep this service thin.
        if (!toggleDebugModeInSession(session, currentPlayerId)) return;
        if (!session) return;
        this.publishSession(session);
    }

    // Local action mode is handled in component local state.
    // Kept to preserve call compatibility with game-view flow.
    setActionMode(enabled: boolean): void {
        void enabled;
    }

    // Local reducer replacing socket command path in static mode.
    executeAction(targetIndex: number, actionType: GameActionType = 'MOVE'): void {
        const session = this.getMutableCurrentSession();
        const currentPlayerId = this.currentPlayerIdSignal();
        if (!session || !currentPlayerId) return;
        if (session.turn.activePlayerId !== currentPlayerId) return;

        const actor = session.players.find((player) => player.id === currentPlayerId);
        if (!actor || actor.state.status !== PlayerStatus.Active || !actor.state.position) return;

        const targetCell = session.map.map[targetIndex];
        if (!targetCell) return;

        switch (actionType) {
            case 'MOVE':
                this.executeMove(session, actor, targetCell);
                break;
            case 'ATTACK':
                this.executeAttack(session, actor, targetCell);
                break;
            case 'INTERACT':
                this.executeInteract(session, actor, targetCell);
                break;
            default:
                break;
        }

        this.publishSession(session);
    }

    // Teleport the active player without consuming movement points while debug mode is enabled.
    teleportToCellInDebugMode(targetIndex: number): void {
        const session = this.getMutableCurrentSession();
        const targetCell = session?.map.map[targetIndex];
        if (!session || !targetCell) return;
        const teleportResult = applyDebugTeleportInSession(session, this.currentPlayerIdSignal(), targetCell);
        if (!teleportResult) return;

        // Compute facing from the previous position before the teleport mutation.
        teleportResult.player.render.facing = localGameRuntimeUtils.getFacingToTarget(
            teleportResult.previousPosition,
            targetCell.position,
        );
        this.publishSession(session);
    }

    // Local surrender flow for static mode.
    // Placeholder only: in static local mode this action is handled at page level
    // (navigate home), without authoritative multiplayer session updates.
    surrender(): void {
        const session = this.getMutableCurrentSession();
        const currentPlayerId = this.currentPlayerIdSignal();
        // Apply organizer-leave cleanup through the shared debug utility.
        if (!disableDebugModeIfOrganizerLeaves(session, currentPlayerId)) return;
        if (!session) return;
        this.publishSession(session);
    }

    // Local chat flow for static mode.
    sendMessage(content: string): void {
        const session = this.getMutableCurrentSession();
        const currentPlayerId = this.currentPlayerIdSignal();
        if (!session || !currentPlayerId) return;

        const normalized = content.trim().slice(0, localGameConstants.CHAT_MESSAGE_MAX_LENGTH);
        if (!normalized) return;

        const author = session.players.find((player) => player.id === currentPlayerId)?.information.name ?? 'Player';
        session.messages.push(this.createChatMessage(author, normalized));
        this.publishSession(session);
    }

    applyLocalSnapshot(snapshot: GameSessionSnapshot): void {
        this.sessions.set(snapshot.id, cloneSession(snapshot));
        persistSessions(this.sessions);
        if (snapshot.id === this.currentSessionIdSignal()) {
            this.sessionSignal.set(cloneSession(snapshot));
        }
    }

    // Local simulated timer tick for static mode. Replace with backend timer/socket updates in multiplayer runtime.
    private startTurnTimer(sessionId: string): void {
        this.stopTurnTimer();
        this.turnTimerId = setInterval(() => {
            const session = this.sessions.get(sessionId);
            if (!session) {
                this.stopTurnTimer();
                return;
            }

            if (session.turn.phase === TurnPhase.Transition || session.turn.activePlayerId === '') {
                this.stopTurnTimer();
                return;
            }

            if (session.turn.remainingSeconds > 0) {
                session.turn.remainingSeconds -= 1;
                this.publishSession(session);
            }

            if (session.turn.remainingSeconds === 0) {
                this.advanceTurn(session, 'TIMEOUT');
                this.publishSession(session);
            }
        }, localGameConstants.TIMER_TICK_MS);
    }

    private stopTurnTimer(): void {
        if (!this.turnTimerId) return;
        clearInterval(this.turnTimerId);
        this.turnTimerId = null;
    }

    private getMutableCurrentSession(): GameSessionSnapshot | null {
        const currentSessionId = this.currentSessionIdSignal();
        if (!currentSessionId) return null;
        return this.sessions.get(currentSessionId) ?? null;
    }

    private executeMove(session: GameSessionSnapshot, actor: Player, targetCell: GameCell): void {
        if (actor.state.remainingMovements <= 0) return;
        if (!targetCell.isWalkable) return;
        if (!actor.state.position) return;
        if (localGameRuntimeUtils.getManhattanDistance(actor.state.position, targetCell.position) !== localGameConstants.SINGLE_STEP_DISTANCE) return;
        if (localGameRuntimeUtils.isPositionOccupiedByAnotherActivePlayer(session, targetCell.position, actor.id)) return;

        actor.render.facing = localGameRuntimeUtils.getFacingToTarget(actor.state.position, targetCell.position);
        localGameRuntimeUtils.setTransientPose(actor, 'walk', localGameConstants.WALK_POSE_DURATION_MS);
        actor.state.position = { ...targetCell.position };
        actor.state.remainingMovements -= 1;
    }

    private executeAttack(session: GameSessionSnapshot, actor: Player, targetCell: GameCell): void {
        if (actor.state.remainingActions <= 0) return;
        if (!actor.state.position) return;
        if (localGameRuntimeUtils.getManhattanDistance(actor.state.position, targetCell.position) !== localGameConstants.SINGLE_STEP_DISTANCE) return;

        const target = session.players.find(
            (player) =>
                player.id !== actor.id &&
                player.state.status === PlayerStatus.Active &&
                player.state.position?.x === targetCell.position.x &&
                player.state.position?.y === targetCell.position.y,
        );
        if (!target) return;

        actor.render.facing = localGameRuntimeUtils.getFacingToTarget(actor.state.position, targetCell.position);
        localGameRuntimeUtils.setTransientPose(actor, 'attack', localGameConstants.ATTACK_POSE_DURATION_MS);

        const attackRoll = localGameRuntimeUtils.rollCombatDie(actor.information.dices.attack);
        const defenseRoll = localGameRuntimeUtils.rollCombatDie(target.information.dices.defense);
        const attackTotal = actor.state.attributes.attack + attackRoll;
        const defenseTotal = target.state.attributes.defense + defenseRoll;
        const damage = Math.max(0, attackTotal - defenseTotal);

        target.state.attributes.health = Math.max(0, target.state.attributes.health - damage);
        actor.state.remainingActions -= 1;

        if (target.state.attributes.health > 0) return;

        target.state.status = PlayerStatus.Eliminated;
        target.render.pose = 'dead';
        target.render.poseStartedAt = undefined;
        target.render.poseDurationMs = undefined;
        this.emitNotification(session.id, GameNotificationKind.PlayerEliminated, `${target.information.name} a ete elimine.`);
        this.endSessionIfSingleActivePlayerRemaining(session);
    }

    private executeInteract(session: GameSessionSnapshot, actor: Player, targetCell: GameCell): void {
        if (actor.state.remainingActions <= 0) return;
        if (!actor.state.position) return;
        if (localGameRuntimeUtils.getManhattanDistance(actor.state.position, targetCell.position) !== localGameConstants.SINGLE_STEP_DISTANCE) return;
        if (targetCell.tileType !== TileType.DOOR) return;

        actor.render.facing = localGameRuntimeUtils.getFacingToTarget(actor.state.position, targetCell.position);
        localGameRuntimeUtils.setTransientPose(actor, 'attack', localGameConstants.ATTACK_POSE_DURATION_MS);
        targetCell.isWalkable = !targetCell.isWalkable;
        actor.state.remainingActions -= 1;
    }

    private advanceTurn(session: GameSessionSnapshot, reason: 'EARLY' | 'TIMEOUT' | 'SURRENDER'): void {
        const activePlayers = session.players.filter((player) => player.state.status === PlayerStatus.Active);
        if (activePlayers.length <= 1) {
            this.endSessionIfSingleActivePlayerRemaining(session);
            return;
        }

        const order = session.turn.order;
        const currentIndex = order.indexOf(session.turn.activePlayerId);
        const startIndex = currentIndex >= 0 ? currentIndex : 0;

        let nextActivePlayerId = activePlayers[0].id;
        for (let offset = 1; offset <= order.length; offset++) {
            const candidateId = order[(startIndex + offset) % order.length];
            const candidate = session.players.find((player) => player.id === candidateId);
            if (candidate && candidate.state.status === PlayerStatus.Active) {
                nextActivePlayerId = candidate.id;
                break;
            }
        }

        session.turn.activePlayerId = nextActivePlayerId;
        session.turn.turnNumber += 1;
        session.turn.remainingSeconds = session.turn.totalSeconds;
        session.turn.phase = TurnPhase.Turn;
        this.resetActivePlayerTurnResources(session, nextActivePlayerId);

        const nextPlayerName = this.getPlayerNameById(session, nextActivePlayerId) ?? 'Next player';
        if (reason === 'EARLY') {
            this.emitNotification(session.id, GameNotificationKind.TurnEndedEarly, `Tour termine hativement.\nProchain joueur: ${nextPlayerName}.`);
            return;
        }
        if (reason === 'TIMEOUT') {
            this.emitNotification(session.id, GameNotificationKind.TurnTimedOut, `Temps restant ecoule.\nProchain joueur: ${nextPlayerName}.`);
        }
    }

    private endSessionIfSingleActivePlayerRemaining(session: GameSessionSnapshot): boolean {
        const activePlayers = session.players.filter((player) => player.state.status === PlayerStatus.Active);
        if (activePlayers.length > 1) return false;

        const winnerName = activePlayers[0]?.information.name;
        session.turn.activePlayerId = '';
        session.turn.phase = TurnPhase.Transition;
        session.turn.remainingSeconds = 0;
        this.stopTurnTimer();

        const reason = winnerName ? `${winnerName} wins the game.` : 'No active players remain.';
        this.emitNotification(session.id, GameNotificationKind.GameEnded, reason);
        return true;
    }

    private resetActivePlayerTurnResources(session: GameSessionSnapshot, activePlayerId: string): void {
        const activePlayer = session.players.find((player) => player.id === activePlayerId);
        if (!activePlayer) return;
        activePlayer.state.remainingMovements = activePlayer.state.attributes.speed;
        activePlayer.state.remainingActions = localGameConstants.DEFAULT_ACTIONS_PER_TURN;
    }

    private emitNotification(sessionId: string, kind: GameNotificationKind, content: string): void {
        this.gameNotificationStateService.handleIncomingNotification(
            {
                sessionId,
                notification: {
                    kind,
                    content,
                    createdAt: new Date().toISOString(),
                },
            },
            this.currentSessionIdSignal(),
        );
    }

    private createChatMessage(author: string, content: string): ChatMessage {
        return {
            id: generateLocalId(),
            author,
            content,
            createdAt: new Date().toISOString(),
        };
    }

    private publishSession(session: GameSessionSnapshot): void {
        this.sessions.set(session.id, session);
        persistSessions(this.sessions);
        if (session.id === this.currentSessionIdSignal()) {
            this.sessionSignal.set(cloneSession(session));
        }
    }

    private getPlayerNameById(session: GameSessionSnapshot, playerId: string): string | undefined {
        return session.players.find((player) => player.id === playerId)?.information.name;
    }
}
