import { computed, Signal } from '@angular/core';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { Player, PlayerFacing, PlayerPose } from '@common/player/player.interface';

export function createPanelAvatarId(currentPlayer: Signal<Player | null>): Signal<number> {
    return computed(() => currentPlayer()?.information.avatarId ?? 0);
}

export function createPanelAvatarState(
    currentPlayer: Signal<Player | null>,
    nowMs: Signal<number>,
): Signal<CharacterState> {
    return computed(() => {
        const currentTimeMs = nowMs();
        const player = currentPlayer();
        if (!player) {
            return PlayerPose.Idle;
        }

        const pose = player.render?.pose ?? PlayerPose.Idle;
        return isTransientPoseExpired(player, pose, currentTimeMs) ? PlayerPose.Idle : pose;
    });
}

export function createPanelAvatarDirection(
    currentPlayer: Signal<Player | null>,
): Signal<CharacterDirection> {
    return computed(() => {
        const player = currentPlayer();
        if (!player) {
            return PlayerFacing.Front;
        }

        return player.render?.facing ?? PlayerFacing.Front;
    });
}

function isTransientPoseExpired(player: Player, pose: CharacterState, nowMs: number): boolean {
    if (pose !== PlayerPose.Walk && pose !== PlayerPose.Attack) {
        return false;
    }

    if (!player.render?.poseStartedAt || !player.render?.poseDurationMs) {
        return false;
    }

    const startedAtMs = Date.parse(player.render.poseStartedAt);
    return !Number.isNaN(startedAtMs) && nowMs >= startedAtMs + player.render.poseDurationMs;
}
