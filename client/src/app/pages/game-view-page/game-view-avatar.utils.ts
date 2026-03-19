import { computed, Signal } from '@angular/core';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { Player, PlayerStatus } from '@common/player/player.interface';

export function createPanelAvatarId(currentPlayer: Signal<Player | null>): Signal<number> {
    return computed(() => currentPlayer()?.information.avatarId ?? 0);
}

export function createPanelAvatarState(
    currentPlayer: Signal<Player | null>,
    nowMs: Signal<number>,
    playerStates: Signal<Readonly<Record<string, CharacterState>>>,
): Signal<CharacterState> {
    return computed(() => {
        nowMs();
        const player = currentPlayer();
        if (!player) {
            return 'idle';
        }

        if (player.state.status === PlayerStatus.Eliminated) {
            return 'dead';
        }

        const localOverride = playerStates()[player.id];
        if (localOverride) {
            return localOverride;
        }

        const pose = player.render?.pose ?? 'idle';
        return isTransientPoseExpired(player, pose, nowMs()) ? 'idle' : pose;
    });
}

export function createPanelAvatarDirection(
    currentPlayer: Signal<Player | null>,
    playerDirections: Signal<Readonly<Record<string, CharacterDirection>>>,
): Signal<CharacterDirection> {
    return computed(() => {
        const player = currentPlayer();
        if (!player) {
            return 'front';
        }

        return playerDirections()[player.id] ?? player.render?.facing ?? 'front';
    });
}

function isTransientPoseExpired(player: Player, pose: CharacterState, nowMs: number): boolean {
    if (pose !== 'walk' && pose !== 'attack') {
        return false;
    }

    if (!player.render?.poseStartedAt || !player.render?.poseDurationMs) {
        return false;
    }

    const startedAtMs = Date.parse(player.render.poseStartedAt);
    return !Number.isNaN(startedAtMs) && nowMs >= startedAtMs + player.render.poseDurationMs;
}
