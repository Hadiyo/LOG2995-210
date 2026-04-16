import {
    advanceToNextTurn as advanceSessionTurn,
    clearTimers,
    clearTurnState,
    pauseTimer,
    resumeTimers,
    startTimerTransition,
    tickTimers,
} from '@app/services/timer/turn.timers';
import { GameSessionEvents } from '@app/utilities/combat/combat.enums';
import { ACTIVE_TURN_DURATION_MS, SNAPSHOT_TICK_MS, TRANSITION_DURATION_MS } from '@app/utilities/game/game.constants';
import { GameSessionLogEntry, GameSessionRuntime } from '@app/utilities/game/game.interface';
import { createActiveTurnState } from '@app/services/game-session/game-session.runtime';
import { TimerConfig } from '@app/utilities/turn/turn.type';
import { ChatMessage } from '@common/chat/chat.interface';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import {
    InitializedMatch,MatchPendingFlagTransfer,
    MatchPlayer,MatchTeamId,
} from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { SessionSocketEvents } from '@common/socket-events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'events';
import { appendCombatRoundLogEntries } from './game-session.combat-round-log';
import { progressGameSessionSanctuaryEffects } from './game-session.sanctuary';

export class GameSessionLifecycle {
    private readonly events2 = new EventEmitter2();
    private readonly startTimerConfig: TimerConfig<GameSessionRuntime> = {
        emitSnapshot: (session) => this.emitSnapshot(session),
        onTransitionEnd: (session) => this.activateTurn(session),
        transitionDuration: TRANSITION_DURATION_MS,
    };

    constructor(
        private readonly sessions: Map<string, GameSessionRuntime>,
        private readonly events: EventEmitter,
    ) {
        this.emitSnapshot = this.emitSnapshot.bind(this);
        this.setNextMatch = this.setNextMatch.bind(this);
    }

    setNextMatch(session: GameSessionRuntime): void {
        const nextMatch = session.match.pendingFlagTransfer
            ? { ...session.match, pendingFlagTransfer: null }
            : session.match;
        session.match = progressGameSessionSanctuaryEffects(nextMatch, session.turnState.activePlayerId);
    }

    finishSurrenderAfterRosterChange(
        session: GameSessionRuntime,
        sessionId: string,
        nextPlayers: MatchPlayer[],
    ): boolean {
        if (nextPlayers.length === 0) {
            clearTimers(session);
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
        clearTurnState(session);
        session.match = {
            ...session.match,
            pendingSanctuaryChoice: null,
        };
        this.emitSnapshot(session);
        this.sessions.delete(session.sessionId);
        this.events2.emit(GameSessionEvents.OnGameEnd, { id: session.sessionId });
    }

    emitSnapshot(session: GameSessionRuntime): void {
        this.events.emit(SessionSocketEvents.GameSessionSnapshot, {
            sessionId: session.sessionId,
            match: session.match,
            turnState: session.turnState,
            messages: session.messages,
            logEntries: session.logEntries.map((entry) => ({ ...entry.entry, involvedPlayers: [...entry.entry.involvedPlayers] })),
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

    finishMatchOnCombatVictories(session: GameSessionRuntime, winner: MatchPlayer): void {
        session.match.endState = {
            id: crypto.randomUUID(),
            winnerKind: 'player',
            winnerPlayerId: winner.id,
            winnerTeamId: session.match.mode === GameMode.CTF ? winner.teamId : null,
            message: `${winner.name} remporte la partie avec ${winner.combatWins} victoires de combat.`,
            resolvedAt: Date.now(),
        };
        this.finishMatch(session);
    }

    createSystemMessage(content: string): ChatMessage {
        return {
            id: crypto.randomUUID(),
            author: 'Journal',
            content,
            createdAt: new Date().toISOString(),
        };
    }

    createLogEntry(content: string, involvedPlayers: string[], visibleToPlayerIds: string[] | null = null): GameSessionLogEntry {
        const entry: GameLogEntry = {
            id: crypto.randomUUID(),
            author: 'Journal',
            content,
            createdAt: new Date().toISOString(),
            involvedPlayers: [...involvedPlayers],
        };

        return {
            entry,
            visibleToPlayerIds: visibleToPlayerIds ? [...visibleToPlayerIds] : null,
        };
    }

    appendLogEntry(
        session: GameSessionRuntime,
        content: string,
        involvedPlayers: string[],
        visibleToPlayerIds: string[] | null = null,
    ): void {
        session.logEntries.push(this.createLogEntry(content, involvedPlayers, visibleToPlayerIds));
    }

    appendCombatRoundLogEntries(session: GameSessionRuntime, statistics: CombatPlayerStatistics[]): void {
        appendCombatRoundLogEntries(session, statistics, this.appendLogEntry.bind(this));
    }

    getActivePlayer(session: GameSessionRuntime): MatchPlayer | null {
        const activePlayerId = session.turnState.order[session.turnState.currentTurnIndex]?.playerId ?? null;
        if (!activePlayerId) {
            return null;
        }
        const activePlayer = session.match.players.find((player) => player.id === activePlayerId) ?? null;
        if (!activePlayer) {
            return null;
        }
        return activePlayer;
    }

    startTransition(session: GameSessionRuntime): void {
        startTimerTransition(session, this.startTimerConfig);
    }

    advanceToNextTurn(session: GameSessionRuntime): void {
        advanceSessionTurn(session, (candidate) => this.setNextMatch(candidate));
        startTimerTransition(session, this.startTimerConfig);
    }

    resumeGameSessionTurn(session: GameSessionRuntime): void {
        resumeTimers(
            session,
            this.emitSnapshot.bind(this),
            (s) => this.activateTurn(s),
            (s) => this.advanceToNextTurn(s),
        );
    }

    stopSessionTimers(session: GameSessionRuntime): void {
        pauseTimer(session);
        this.emitSnapshot(session);
    }

    private activateTurn(session: GameSessionRuntime): void {
        const activePlayer = this.getActivePlayer(session);
        if (!activePlayer) {
            return;
        }

        clearTimers(session);
        session.turnState = createActiveTurnState(session.turnState, activePlayer, ACTIVE_TURN_DURATION_MS);
        this.appendLogEntry(session, `Debut du tour de ${activePlayer.name}.`, [activePlayer.name]);
        this.emitSnapshot(session);
        session.timerIntervalId = setInterval(() => tickTimers(session, (candidate) => this.emitSnapshot(candidate)), SNAPSHOT_TICK_MS);
        session.activeTurnTimeoutId = setTimeout(() => this.advanceToNextTurn(session), ACTIVE_TURN_DURATION_MS);
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
