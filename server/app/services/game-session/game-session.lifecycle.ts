import { EndStatsService } from '@app/services/end-stats.service';
import { ChatMessage } from '@common/chat/chat.interface';
import {
    InitializedMatch,
    MatchPendingFlagTransfer,
    MatchPlayer,
    MatchTeamId,
} from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { SessionSocketEvents } from '@common/socket-events';
import { EventEmitter } from 'events';
import {
    ACTIVE_TURN_DURATION_MS,
    createActiveTurnState,
    createTransitionTurnState,
    GameSessionRuntime,
    SNAPSHOT_TICK_MS,
    TRANSITION_DURATION_MS,
} from './game-session.runtime';
import { progressGameSessionSanctuaryEffects } from './game-session.sanctuary';
import { clearGameSessionTimers, tickGameSessionTimers } from './game-session.timers';

export class GameSessionLifecycle {
    constructor(
        private readonly sessions: Map<string, GameSessionRuntime>,
        private readonly events: EventEmitter,
        private readonly endStatsService: EndStatsService,
    ) {}

    startTransition(session: GameSessionRuntime): void {
        clearGameSessionTimers(session);
        session.turnState = createTransitionTurnState(session.turnState);
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => tickGameSessionTimers(session, (candidate) => this.emitSnapshot(candidate)), SNAPSHOT_TICK_MS);
        session.transitionTimeoutId = setTimeout(() => this.activateTurn(session), TRANSITION_DURATION_MS);
    }

    advanceToNextTurn(session: GameSessionRuntime): void {
        clearGameSessionTimers(session);
        if (session.turnState.order.length === 0) {
            return;
        }

        const nextMatch = session.match.pendingFlagTransfer
            ? { ...session.match, pendingFlagTransfer: null }
            : session.match;
        session.match = progressGameSessionSanctuaryEffects(nextMatch, session.turnState.activePlayerId);
        session.turnState = {
            ...session.turnState,
            currentTurnIndex: (session.turnState.currentTurnIndex + 1) % session.turnState.order.length,
        };
        this.startTransition(session);
        this.endStatsService.endTurn(session.sessionId);
    }

    finishSurrenderAfterRosterChange(
        session: GameSessionRuntime,
        sessionId: string,
        nextPlayers: MatchPlayer[],
    ): boolean {
        if (nextPlayers.length === 0) {
            clearGameSessionTimers(session);
            this.sessions.delete(sessionId);
            this.endStatsService.endSession(sessionId);
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
                    message: `La partie est annulée: l'équipe ${missingTeamId} n'a plus aucun joueur suite à des abandons.`,
                    resolvedAt: Date.now(),
                },
            };
            this.finishMatch(session);
            return true;
        }

        if (nextPlayers.length !== 1) {
            return false;
        }

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

    finishMatch(session: GameSessionRuntime): void {
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
        this.events.emit(SessionSocketEvents.EndGame, session.sessionId);
    }

    emitSnapshot(session: GameSessionRuntime): void {
        this.events.emit(SessionSocketEvents.GameSessionSnapshot, {
            sessionId: session.sessionId,
            match: session.match,
            turnState: session.turnState,
            messages: session.messages,
        });
    }

    getDoorToggleContext(
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

    getCombatContext(
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
        if (!attacker || !defender || !this.canStartCombat(session.match, attacker, defender)) {
            return null;
        }

        return { session, attacker, defender };
    }

    isCurrentTurnPlayer(playerId: string, turnState: MatchTurnState): boolean {
        return turnState.activePlayerId === playerId || turnState.transitionTargetPlayerId === playerId;
    }

    isCtfWinner(match: InitializedMatch, playerId: string): boolean {
        if (match.mode !== GameMode.CTF || match.flagCarrierId !== playerId) {
            return false;
        }

        const player = match.players.find((candidate) => candidate.id === playerId);
        return !!player &&
            player.position.x === player.startingPosition.x &&
            player.position.y === player.startingPosition.y;
    }

    createPendingFlagTransfer(
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

    clearPendingFlagTransfer(pendingFlagTransfer: MatchPendingFlagTransfer | null, playerId: string): MatchPendingFlagTransfer | null {
        if (!pendingFlagTransfer) {
            return null;
        }

        return pendingFlagTransfer.requesterId === playerId || pendingFlagTransfer.receiverId === playerId ? null : pendingFlagTransfer;
    }

    buildFlagTransferMessage(
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

    canResolveFlagTransfer(
        session: GameSessionRuntime | undefined,
        pendingFlagTransfer: MatchPendingFlagTransfer | null,
        receiverId: string,
    ): session is GameSessionRuntime {
        return !!session && !!pendingFlagTransfer && pendingFlagTransfer.receiverId === receiverId && !session.match.endState;
    }

    resolveTransferredFlagCarrierId(
        match: InitializedMatch,
        pendingFlagTransfer: MatchPendingFlagTransfer,
        accepted: boolean,
    ): string | null {
        if (!accepted) {
            return match.flagCarrierId ?? null;
        }

        return pendingFlagTransfer.kind === 'offer' ? pendingFlagTransfer.receiverId : pendingFlagTransfer.requesterId;
    }

    finishCtfMatchIfFlagTransferWins(session: GameSessionRuntime, accepted: boolean, nextFlagCarrierId: string | null): boolean {
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
                message: `L'équipe ${winner.teamId ?? '?'} remporte la partie: ${winner.name} ramène le drapeau à son point de départ.`,
                resolvedAt: Date.now(),
            },
        };
        this.finishMatch(session);
        return true;
    }

    createSystemMessage(content: string): ChatMessage {
        return {
            id: crypto.randomUUID(),
            author: 'Journal',
            content,
            createdAt: new Date().toISOString(),
        };
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

    private canStartCombat(match: InitializedMatch, attacker: MatchPlayer, defender: MatchPlayer): boolean {
        if (Math.abs(attacker.position.x - defender.position.x) + Math.abs(attacker.position.y - defender.position.y) !== 1) {
            return false;
        }

        return match.mode !== GameMode.CTF ||
            attacker.teamId === null ||
            attacker.teamId === undefined ||
            attacker.teamId !== defender.teamId;
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
}
