import { Injectable, signal } from '@angular/core';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';

// Default resting pose used after transient visual states end.
const IDLE_STATE: CharacterState = 'idle';

@Injectable({
    providedIn: 'root',
})
export class GameVisualFeedbackService {
    // Per-player direction override used by renderers (local visual layer only).
    private readonly playerDirectionSignal = signal<Record<string, CharacterDirection>>({});
    readonly playerDirections = this.playerDirectionSignal.asReadonly();

    // Per-player pose override used by renderers (local visual layer only).
    private readonly playerStateSignal = signal<Record<string, CharacterState>>({});
    readonly playerStates = this.playerStateSignal.asReadonly();

    // Timeout registry to cancel/replace pending transient-state resets per player.
    private readonly stateResetTimeoutByPlayerId = new Map<string, ReturnType<typeof setTimeout>>();

    // Public visual helper: set facing direction for one player.
    // Used by click feedback before server state round-trip.
    setVisualDirection(playerId: string, direction: CharacterDirection): void {
        this.setDirection(playerId, direction);
    }

    // Public visual helper: apply short-lived state (walk/attack), then auto-reset to idle.
    // Used by click feedback before server state round-trip.
    setVisualTransientState(playerId: string, state: CharacterState, durationMs: number): void {
        this.setTransientState(playerId, state, durationMs);
    }

    // Clears all pending state-reset timers to avoid leaks and stale callbacks.
    clearStateResetTimeouts(): void {
        for (const timeout of this.stateResetTimeoutByPlayerId.values()) {
            clearTimeout(timeout);
        }
        this.stateResetTimeoutByPlayerId.clear();
    }

    // Resets all local visual overrides and pending timers.
    // Useful on page enter/leave and session changes.
    resetVisualOverrides(): void {
        this.clearStateResetTimeouts();
        this.playerDirectionSignal.set({});
        this.playerStateSignal.set({});
    }

    // Internal immutable update for a single player's direction override.
    private setDirection(playerId: string, direction: CharacterDirection): void {
        this.playerDirectionSignal.update((current) => ({
            ...current,
            [playerId]: direction,
        }));
    }

    // Internal immutable update for a single player's pose override.
    private setState(playerId: string, state: CharacterState): void {
        this.playerStateSignal.update((current) => ({
            ...current,
            [playerId]: state,
        }));
    }

    // Internal transient-state manager:
    // - apply immediate state
    // - cancel previous reset timer for same player
    // - schedule idle reset after duration
    // - keep dead state sticky (never auto-reset to idle)
    private setTransientState(playerId: string, state: CharacterState, durationMs: number): void {
        this.setState(playerId, state);

        const existingTimeout = this.stateResetTimeoutByPlayerId.get(playerId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
            this.playerStateSignal.update((current) => {
                if (current[playerId] === 'dead') return current;
                return {
                    ...current,
                    [playerId]: IDLE_STATE,
                };
            });
            this.stateResetTimeoutByPlayerId.delete(playerId);
        }, durationMs);

        this.stateResetTimeoutByPlayerId.set(playerId, timeout);
    }

}
