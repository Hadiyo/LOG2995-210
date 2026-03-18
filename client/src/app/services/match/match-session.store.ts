import { inject, signal } from '@angular/core';
import { Character } from '@common/character/character.interface';
import { InitializedMatch, MatchLobbyPlayer } from '@common/game/match.interface';
import { MapSummary } from '@common/maps/map.interface';
import {
    LOCAL_PLAYER_STORAGE_KEY,
    MATCH_STATE_STORAGE_KEY,
    SELECTED_MAP_STORAGE_KEY,
} from './match-defaults';
import { MatchSetupService } from './match-setup.service';
import { TurnStateService } from './turn-state.service';

export type MatchLoadState = 'idle' | 'loading' | 'ready' | 'error';

export abstract class MatchSessionStore {
    protected readonly turnStateService = inject(TurnStateService);
    protected readonly matchSetupService = inject(MatchSetupService);

    readonly selectedMap = signal<MapSummary | null>(this.readStoredJson<MapSummary>(SELECTED_MAP_STORAGE_KEY));
    readonly localPlayer = signal<MatchLobbyPlayer | null>(
        this.matchSetupService.normalizeLobbyPlayer(this.readStoredJson<MatchLobbyPlayer>(LOCAL_PLAYER_STORAGE_KEY)),
    );
    readonly match = signal<InitializedMatch | null>(
        this.matchSetupService.normalizeMatch(this.readStoredJson<InitializedMatch>(MATCH_STATE_STORAGE_KEY)),
    );
    readonly state = signal<MatchLoadState>('idle');
    readonly errorMessage = signal('');

    selectMap(map: MapSummary): void {
        this.selectedMap.set({ ...map });
        this.resetMatchState();
        this.errorMessage.set('');
        this.writeStoredJson(SELECTED_MAP_STORAGE_KEY, map);
    }

    registerLocalPlayer(character: Character): void {
        const localPlayer = this.matchSetupService.buildLocalPlayer(character, this.localPlayer());

        this.localPlayer.set(localPlayer);
        this.resetMatchState();
        this.errorMessage.set('');
        this.writeStoredJson(LOCAL_PLAYER_STORAGE_KEY, localPlayer);
    }

    protected setPersistedMatch(match: InitializedMatch): void {
        this.match.set(match);
        this.writeStoredJson(MATCH_STATE_STORAGE_KEY, match);
    }

    protected resetMatchState(): void {
        this.turnStateService.clear();
        this.match.set(null);
        this.state.set('idle');
        this.errorMessage.set('');
        localStorage.removeItem(MATCH_STATE_STORAGE_KEY);
    }

    protected clearLocalPlayer(): void {
        this.localPlayer.set(null);
        localStorage.removeItem(LOCAL_PLAYER_STORAGE_KEY);
    }

    protected readStoredJson<T>(key: string): T | null {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
            return null;
        }

        try {
            return JSON.parse(rawValue) as T;
        } catch {
            localStorage.removeItem(key);
            return null;
        }
    }

    protected writeStoredJson(key: string, value: unknown): void {
        localStorage.setItem(key, JSON.stringify(value));
    }
}
