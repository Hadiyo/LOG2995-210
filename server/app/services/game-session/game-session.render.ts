import { MatchPlayer } from '@common/game/match.interface';
import { PlayerRenderState } from '@common/player/player.interface';
import {
    createGameSessionInitialRenderState,
    getGameSessionFacingToTarget,
} from './game-session.match';

export function applyFacingTowardPosition(player: MatchPlayer, target: { x: number; y: number }): MatchPlayer {
    const facing = getGameSessionFacingToTarget(player.position, target);
    if (!facing) {
        return player;
    }

    return {
        ...player,
        render: {
            ...createGameSessionInitialRenderState(),
            ...player.render,
            facing,
        },
    };
}

export function setTransientPose(player: MatchPlayer, pose: 'walk' | 'attack', durationMs: number): MatchPlayer {
    return {
        ...player,
        render: {
            ...createGameSessionInitialRenderState(),
            ...player.render,
            pose,
            poseStartedAt: new Date().toISOString(),
            poseDurationMs: durationMs,
        } satisfies PlayerRenderState,
    };
}
