import { EndStatsService } from '@app/services/end-stats.service';
import { ATTACK_POSE_DURATION_MS, WALK_POSE_DURATION_MS } from '@app/utilities/game/game.constants';
import { GameSessionRuntime } from '@app/utilities/game/game.interface';
import { MovementDirection } from '@common/game/movement-direction';
import { MatchSanctuaryChoice } from '@common/game/match.interface';
import { buildVisibleObjects, resolveFlagCarrier } from '@common/game/match.utils';
import { PlayerPose } from '@common/player/player.interface';
import { GameSessionLifecycle } from './game-session.lifecycle';
import { getGameSessionDestination, getGameSessionMovementCost } from './game-session.match';
import { applyFacingTowardPosition, setTransientPose } from './game-session.render';
import {
    beginGameSessionSanctuaryChoice,
    resolveGameSessionSanctuaryChoice,
} from './game-session.sanctuary';

export class GameSessionActions {
    constructor(
        private readonly sessions: Map<string, GameSessionRuntime>,
        private readonly lifecycle: GameSessionLifecycle,
        private readonly endStatsService: EndStatsService,
    ) {}

    movePlayer(sessionId: string, playerId: string, direction: MovementDirection): boolean {
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

        this.endStatsService.visitTile(sessionId, destination, playerId);

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
        const nextFlagCarrierId = resolveFlagCarrier(session.match, playerId, destination);
        if (nextFlagCarrierId) {
            this.endStatsService.getFlag(sessionId, nextFlagCarrierId);
        }

        const pickedUpFlag = session.match.flagCarrierId === null && nextFlagCarrierId === playerId;
        session.match = {
            ...session.match,
            players: nextPlayers,
            flagCarrierId: nextFlagCarrierId,
            objects: buildVisibleObjects(session.match.allObjects, nextPlayers, nextFlagCarrierId),
        };
        if (pickedUpFlag) {
            const content = `${movingPlayer.name} ramasse le drapeau.`;
            this.lifecycle.appendLogEntry(session, content, [movingPlayer.name]);
        }
        session.turnState = {
            ...session.turnState,
            movementPointsRemaining: session.turnState.movementPointsRemaining - cost,
            movementCount: session.turnState.movementCount + 1,
        };

        if (this.lifecycle.isCtfWinner(session.match, playerId)) {
            const winner = session.match.players.find((player) => player.id === playerId) ?? movingPlayer;
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
            this.lifecycle.finishMatch(session);
            return true;
        }

        this.lifecycle.emitSnapshot(session);
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

        this.endStatsService.useSanctuary(sessionId, sanctuaryId);

        session.match = {
            ...session.match,
            pendingSanctuaryChoice,
        };
        this.lifecycle.emitSnapshot(session);
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
            const actingPlayer = session.match.players.find((player) => player.id === playerId);
            if (actingPlayer) {
                this.lifecycle.appendLogEntry(session, `${actingPlayer.name} utilise un sanctuaire.`, [actingPlayer.name]);
            }
        }

        this.lifecycle.emitSnapshot(session);
        return true;
    }

    toggleDoor(sessionId: string, playerId: string, position: { x: number; y: number }): boolean {
        const actionContext = this.lifecycle.getDoorToggleContext(sessionId, playerId, position);
        if (!actionContext) {
            return false;
        }

        this.endStatsService.useDoor(sessionId, position);

        const { session, player } = actionContext;
        const targetDoor = session.match.map.find((cell) => cell.position.x === position.x && cell.position.y === position.y);
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
        if (targetDoor) {
            this.lifecycle.appendLogEntry(
                session,
                `${player.name} ${targetDoor.isWalkable ? 'ferme' : 'ouvre'} une porte.`,
                [player.name],
            );
        }
        this.lifecycle.emitSnapshot(session);
        return true;
    }
}
