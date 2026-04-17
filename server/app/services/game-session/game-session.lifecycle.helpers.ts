import { InitializedMatch, MatchPendingFlagTransfer, MatchPlayer, MatchTeamId } from '@common/game/match.interface';
import { GameMode } from '@common/maps/map.enums';

export function getMissingCtfTeamId(mode: GameMode, players: MatchPlayer[]): MatchTeamId | null {
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

export function createPendingFlagTransfer(
    match: InitializedMatch,
    requesterId: string,
    receiverId: string,
): MatchPendingFlagTransfer | null {
    if (match.mode !== GameMode.CTF || match.pendingFlagTransfer) {
        return null;
    }

    const requester = match.players.find((player) => player.id === requesterId) ?? null;
    const receiver = match.players.find((player) => player.id === receiverId) ?? null;
    if (!requester || !receiver || requester.controller === 'virtual') {
        return null;
    }

    const sameTeam = requester.teamId != null && requester.teamId === receiver.teamId;
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

export function clearPendingFlagTransfer(
    pendingFlagTransfer: MatchPendingFlagTransfer | null,
    playerId: string,
): MatchPendingFlagTransfer | null {
    if (!pendingFlagTransfer) {
        return null;
    }

    return pendingFlagTransfer.requesterId === playerId || pendingFlagTransfer.receiverId === playerId ? null : pendingFlagTransfer;
}

export function buildFlagTransferMessage(
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

export function resolveTransferredFlagCarrierId(
    match: InitializedMatch,
    pendingFlagTransfer: MatchPendingFlagTransfer,
    accepted: boolean,
): string | null {
    if (!accepted) {
        return match.flagCarrierId ?? null;
    }

    return pendingFlagTransfer.kind === 'offer' ? pendingFlagTransfer.receiverId : pendingFlagTransfer.requesterId;
}
