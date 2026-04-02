import { inject, Injectable } from '@angular/core';
import {
    InitializedMatch,
    MatchEndState,
    MatchLobbyPlayer,
    MatchPlayer,
    MatchTileInspection,
} from '@common/game/match.interface';
import { EditorMapDetails, MapObject, Vec2 } from '@common/maps/map.interface';
import {
    HOME_RETURN_MESSAGE_STORAGE_KEY,
} from './match-defaults';
import { MatchBoardService, CombatAftermathResult } from './match-board.service';
import { MatchSessionStore } from './match-session.store';

@Injectable({ providedIn: 'root' })
export class MatchStateService extends MatchSessionStore {
    private readonly matchBoardService = inject(MatchBoardService);

    buildInitializedMatch(map: EditorMapDetails, players: MatchLobbyPlayer[], random: () => number): InitializedMatch {
        return this.matchSetupService.buildInitializedMatch(map, players, random);
    }

    removePlayer(playerId: string): void {
        const isLocalPlayer = this.localPlayer()?.id === playerId;

        if (isLocalPlayer) {
            this.clearLocalPlayer();
            this.resetMatchState();
            return;
        }

        const currentMatch = this.match();
        if (!currentMatch) return;

        const nextMatch = this.buildMatchWithoutPlayer(currentMatch, playerId);
        if (!nextMatch) {
            this.resetMatchState();
            return;
        }

        this.setPersistedMatch(nextMatch);
        this.turnStateService.removePlayer(playerId);
    }

    async initializeFromPendingSelection(): Promise<boolean> {
        const persistedMatch = this.match();
        if (!persistedMatch) {
            return false;
        }
        this.state.set('ready');
        return true;
    }

    hydrateSnapshot(match: InitializedMatch | null): void {
        if (!match) {
            this.resetMatchState();
            return;
        }

        this.setPersistedMatch(this.matchSetupService.normalizeMatch(match) ?? match);
        this.state.set('ready');
        this.errorMessage.set('');
    }

    abandonLocalPlayer(message: string): void {
        const localPlayer = this.localPlayer();
        if (!localPlayer) {
            this.endLocalSession(message);
            return;
        }

        const nextMatch = this.buildMatchWithoutPlayer(this.match(), localPlayer.id);
        this.setHomeReturnMessage(message);
        this.clearLocalPlayer();

        if (!nextMatch) {
            this.resetMatchState();
            return;
        }

        this.setPersistedMatch(nextMatch);
        this.turnStateService.removePlayer(localPlayer.id);
        this.state.set('idle');
        this.errorMessage.set('');
    }

    applyCombatAftermath(defeatedPlayerIds: string[]): CombatAftermathResult | null {
        const currentMatch = this.match();
        if (!currentMatch) {
            return null;
        }

        const aftermath = this.matchBoardService.applyCombatAftermath(currentMatch, defeatedPlayerIds);
        if (!aftermath) {
            return null;
        }

        this.setPersistedMatch(aftermath.nextMatch);
        return aftermath.outcome;
    }

    endLocalSession(message: string): void {
        this.setHomeReturnMessage(message);
        this.clearLocalPlayer();
        this.resetMatchState();
    }

    setHomeReturnMessage(message: string): void {
        this.writeStoredJson(HOME_RETURN_MESSAGE_STORAGE_KEY, message);
    }

    consumeHomeReturnMessage(): string | null {
        const message = this.readStoredJson<string>(HOME_RETURN_MESSAGE_STORAGE_KEY);
        localStorage.removeItem(HOME_RETURN_MESSAGE_STORAGE_KEY);
        return message;
    }

    registerCombatVictory(playerId: string): { player: MatchPlayer | null; endState: MatchEndState | null } | null {
        const currentMatch = this.match();
        if (!currentMatch) {
            return null;
        }

        const currentWinner = currentMatch.players.find((player) => player.id === playerId) ?? null;
        if (!currentWinner) {
            return null;
        }

        const updatedWinner = {
            ...currentWinner,
            combatWins: currentWinner.combatWins + 1,
        };
        const nextPlayers = currentMatch.players.map((player) =>
            player.id === playerId ? updatedWinner : player,
        );
        const endState = !currentMatch.endState && this.matchSetupService.isClassicWinner(updatedWinner.combatWins)
            ? this.matchSetupService.createClassicEndState(updatedWinner)
            : currentMatch.endState ?? null;

        this.setPersistedMatch({ ...currentMatch, players: nextPlayers, endState });

        return {
            player: updatedWinner,
            endState,
        };
    }

    getPlayerAt(position: Vec2): MatchPlayer | null {
        const currentMatch = this.match();
        return currentMatch ? this.matchBoardService.getPlayerAt(currentMatch, position) : null;
    }

    getObjectCovering(position: Vec2): MapObject | null {
        const currentMatch = this.match();
        return currentMatch ? this.matchBoardService.getObjectCovering(currentMatch.objects, position) : null;
    }

    inspectTile(position: Vec2): MatchTileInspection | null {
        const currentMatch = this.match();
        return currentMatch ? this.matchBoardService.inspectTile(currentMatch, position) : null;
    }

    private buildMatchWithoutPlayer(currentMatch: InitializedMatch | null, playerId: string): InitializedMatch | null {
        if (!currentMatch) {
            return null;
        }

        const remainingPlayers = currentMatch.players.filter((player) => player.id !== playerId);
        if (remainingPlayers.length === 0) {
            return null;
        }

        return {
            ...currentMatch,
            players: remainingPlayers,
            objects: this.matchBoardService.buildVisibleObjects(currentMatch.allObjects, remainingPlayers),
            pendingSanctuaryChoice: currentMatch.pendingSanctuaryChoice?.playerId === playerId
                ? null
                : currentMatch.pendingSanctuaryChoice ?? null,
            endState: remainingPlayers.length === 1 && !currentMatch.endState
                ? this.matchSetupService.createNoWinnerEndState(remainingPlayers[0])
                : currentMatch.endState ?? null,
        };
    }
}
