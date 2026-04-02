import { ChatMessage } from '@common/chat/chat.interface';
import { buildVisibleObjects } from '@common/game/match.utils';
import { ObjectType } from '@common/maps/map.enums';
import { canUseDebugTeleport, isDebugTeleportDestinationAvailable } from './game-session.debug';
import { GameSessionLifecycle } from './game-session.lifecycle';
import { applyFacingTowardPosition } from './game-session.render';
import { GameSessionRuntime, rebuildTurnStateAfterRosterChange } from './game-session.runtime';

export class GameSessionSessionActions {
    constructor(
        private readonly sessions: Map<string, GameSessionRuntime>,
        private readonly lifecycle: GameSessionLifecycle,
    ) {}

    endTurn(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session ||
            session.turnState.phase !== 'active' ||
            session.turnState.activePlayerId !== playerId ||
            session.match.pendingSanctuaryChoice) {
            return false;
        }

        this.lifecycle.advanceToNextTurn(session);
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

        const pendingFlagTransfer = this.lifecycle.createPendingFlagTransfer(session.match, requesterId, receiverId);
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
        this.lifecycle.emitSnapshot(session);
        return true;
    }

    resolveFlagTransfer(sessionId: string, receiverId: string, accepted: boolean): boolean {
        const session = this.sessions.get(sessionId);
        const pendingFlagTransfer = session?.match.pendingFlagTransfer ?? null;
        if (!this.lifecycle.canResolveFlagTransfer(session, pendingFlagTransfer, receiverId)) {
            return false;
        }

        const nextFlagCarrierId = this.lifecycle.resolveTransferredFlagCarrierId(session.match, pendingFlagTransfer, accepted);
        session.match = {
            ...session.match,
            flagCarrierId: nextFlagCarrierId,
            pendingFlagTransfer: null,
            objects: buildVisibleObjects(session.match.allObjects, session.match.players, nextFlagCarrierId),
        };

        if (accepted) {
            const transferMessage = this.lifecycle.buildFlagTransferMessage(session.match, pendingFlagTransfer, nextFlagCarrierId);
            if (transferMessage) {
                session.messages.push(this.lifecycle.createSystemMessage(transferMessage));
            }
        }

        if (this.lifecycle.finishCtfMatchIfFlagTransferWins(session, accepted, nextFlagCarrierId)) {
            return true;
        }

        this.lifecycle.emitSnapshot(session);
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
        const nextPendingFlagTransfer = this.lifecycle.clearPendingFlagTransfer(session.match.pendingFlagTransfer ?? null, playerId);
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
            objects: buildVisibleObjects(nextAllObjects, nextPlayers, nextFlagCarrierId),
            pendingSanctuaryChoice: session.match.pendingSanctuaryChoice?.playerId === playerId ? null : session.match.pendingSanctuaryChoice ?? null,
        };

        const removedTurnPlayer = this.lifecycle.isCurrentTurnPlayer(playerId, session.turnState);
        if (this.lifecycle.finishSurrenderAfterRosterChange(session, sessionId, nextPlayers)) {
            return true;
        }

        session.turnState = rebuildTurnStateAfterRosterChange(session.turnState, nextPlayers);
        if (removedTurnPlayer) {
            this.lifecycle.startTransition(session);
            return true;
        }

        this.lifecycle.emitSnapshot(session);
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
        this.lifecycle.emitSnapshot(session);
        return true;
    }

    forceEndDebugTurn(sessionId: string, playerId: string): boolean {
        const session = this.sessions.get(sessionId);
        const player = session?.match.players.find((candidate) => candidate.id === playerId);
        if (!session || !session.match.debugMode || !player?.isOrganizer || session.match.endState) {
            return false;
        }

        this.lifecycle.advanceToNextTurn(session);
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
        this.lifecycle.emitSnapshot(session);
        return true;
    }

    addChatMessage(sessionId: string, message: ChatMessage): ChatMessage | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        session.messages.push(message);
        this.lifecycle.emitSnapshot(session);
        return message;
    }
}
