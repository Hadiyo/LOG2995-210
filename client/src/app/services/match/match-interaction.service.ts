import { Injectable } from '@angular/core';
import { InitializedMatch, MatchPendingFlagTransfer } from '@common/game/match.interface';
import { GameMode } from '@common/maps/map.enums';
import { MatchBoardService } from './match-board.service';

@Injectable({ providedIn: 'root' })
export class MatchInteractionService {
    constructor(private readonly matchBoardService: MatchBoardService) {}

    requestFlagTransfer(match: InitializedMatch, requesterId: string, receiverId: string): MatchPendingFlagTransfer | null {
        if (match.mode !== GameMode.CTF || match.pendingFlagTransfer) {
            return null;
        }

        const requester = match.players.find((player) => player.id === requesterId) ?? null;
        const receiver = match.players.find((player) => player.id === receiverId) ?? null;
        if (!requester || !receiver) {
            return null;
        }

        if (requester.controller === 'virtual') {
            return null;
        }

        if (!this.matchBoardService.isSameTeam(requester, receiver) || !this.matchBoardService.areAdjacent(requester.position, receiver.position)) {
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
}
