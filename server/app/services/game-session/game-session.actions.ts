import { buildVisibleObjects, resolveFlagCarrier } from '@common/game/match.utils';
import { MatchSanctuaryChoice } from '@common/game/match.interface';
import { ObjectType } from '@common/maps/map.enums';
import { PlayerPose } from '@common/player/player.interface';
import { GameSessionLifecycle } from './game-session.lifecycle';
import {
    ATTACK_POSE_DURATION_MS,
    getGameSessionDestination,
    getGameSessionMovementCost,
    WALK_POSE_DURATION_MS,
} from './game-session.match';
import { applyFacingTowardPosition, setTransientPose } from './game-session.render';
import {
    beginGameSessionSanctuaryChoice,
    resolveGameSessionSanctuaryChoice,
} from './game-session.sanctuary';
import {
    CLASSIC_WIN_THRESHOLD,
    GameSessionRuntime,
    resolveRespawnPosition,
} from './game-session.runtime';

export class GameSessionActions {
    constructor(
        private readonly sessions: Map<string, GameSessionRuntime>,
        private readonly lifecycle: GameSessionLifecycle,
    ) {}

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
        const nextFlagCarrierId = resolveFlagCarrier(session.match, playerId, destination);
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

    startCombat(sessionId: string, attackerId: string, defenderId: string): boolean {
        const combatContext = this.lifecycle.getCombatContext(sessionId, attackerId, defenderId);
        if (!combatContext) {
            return false;
        }

        const { session, attacker, defender } = combatContext;
        this.lifecycle.appendLogEntry(
            session,
            `${attacker.name} remporte un combat contre ${defender.name}.`,
            [attacker.name, defender.name],
            [attackerId, defenderId],
        );
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
            this.lifecycle.finishMatch(session);
            return true;
        }

        this.lifecycle.emitSnapshot(session);
        return true;
    }
}
