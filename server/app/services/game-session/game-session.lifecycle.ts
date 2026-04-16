import { EndStatsService } from '@app/services/end-stats.service';
import {
    activateTurn,
    advanceToNextTurn as advanceSessionTurn,
    clearTimers,
    clearTurnState,
    pauseTimer,
    resumeTimers,
    startTimerTransition,
} from '@app/services/timer/turn.timers';
import { GameSessionEvents } from '@app/utilities/combat/combat.enums';
import { ACTIVE_TURN_DURATION_MS, TRANSITION_DURATION_MS } from '@app/utilities/game/game.constants';
import { GameSessionLogEntry, GameSessionRuntime } from '@app/utilities/game/game.interface';
import { TimerConfig } from '@app/utilities/turn/turn.type';
import { ChatMessage } from '@common/chat/chat.interface';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import {
    InitializedMatch,
    MatchPendingFlagTransfer,
    MatchPlayer,
} from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { SessionSocketEvents } from '@common/socket-events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'events';
import { appendCombatRoundLogEntries } from './game-session.combat-round-log';
import { getMissingCtfTeamId } from './game-session.lifecycle.helpers';
import { progressGameSessionSanctuaryEffects } from './game-session.sanctuary';

export class GameSessionLifecycle {
    private readonly events2 = new EventEmitter2();
    private readonly startTimerConfig: TimerConfig<GameSessionRuntime> = {
        emitSnapshot: (session) => this.emitSnapshot(session),
        onTransitionEnd: (session) => this.activateTurn(session),
        transitionDuration: TRANSITION_DURATION_MS,
    };
    private readonly activeTurnConfig: TimerConfig<GameSessionRuntime> = {
        emitSnapshot: (session) => this.emitSnapshot(session),
        onTransitionEnd: (session) => this.advanceToNextTurn(session),
        transitionDuration: ACTIVE_TURN_DURATION_MS,
    };

    constructor(
        private readonly sessions: Map<string, GameSessionRuntime>,
        private readonly events: EventEmitter,
        private readonly endStatsService: EndStatsService,
        private readonly syncAutomation: (session: GameSessionRuntime) => void = () => undefined,
    ) {
        this.emitSnapshot = this.emitSnapshot.bind(this);
        this.setNextMatch = this.setNextMatch.bind(this);
    }

    setNextMatch(session: GameSessionRuntime): void {
        const nextMatch = session.match.pendingFlagTransfer
            ? { ...session.match, pendingFlagTransfer: null }
            : session.match;
        session.match = progressGameSessionSanctuaryEffects(nextMatch, session.turnState.activePlayerId);
        this.endStatsService.endTurn(session.sessionId);
    }

    finishSurrenderAfterRosterChange(
        session: GameSessionRuntime,
        sessionId: string,
        nextPlayers: MatchPlayer[],
    ): boolean {
        if (nextPlayers.length === 0) {
            clearTimers(session);
            this.sessions.delete(sessionId);
            this.events2.emit(GameSessionEvents.OnGameEnd, { id: session.sessionId });
            this.endStatsService.endSession(sessionId);
            return true;
        }

        const missingTeamId = getMissingCtfTeamId(session.match.mode, nextPlayers);
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
        this.events.emit(SessionSocketEvents.EndGame, session.sessionId);
        this.sessions.delete(session.sessionId);
        this.events2.emit(GameSessionEvents.OnGameEnd, { id: session.sessionId });
        this.endStatsService.endSession(session.sessionId);
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

    canResolveFlagTransfer(
        session: GameSessionRuntime | undefined,
        pendingFlagTransfer: MatchPendingFlagTransfer | null,
        receiverId: string,
    ): session is GameSessionRuntime {
        return !!session && !!pendingFlagTransfer && pendingFlagTransfer.receiverId === receiverId && !session.match.endState;
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
        this.syncAutomation(session);
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
        this.syncAutomation(session);
    }

    stopSessionTimers(session: GameSessionRuntime): void {
        pauseTimer(session);
        this.emitSnapshot(session);
    }

    private activateTurn(session: GameSessionRuntime): void {
        activateTurn(session, this.getActivePlayer, this.activeTurnConfig);
        const activePlayer = this.getActivePlayer(session);
        if (activePlayer) {
            this.appendLogEntry(session, `Debut du tour de ${activePlayer.name}.`, [activePlayer.name]);
            this.emitSnapshot(session);
        }
        this.syncAutomation(session);
    }
}
