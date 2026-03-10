import { GameSessionSnapshot } from '@common/game-session';
import { Vec2 } from '@common/maps/map.interface';
import { GamePlayerState, PlayerStatus } from '@common/player/player.interface';
import { D4_MAX, D6_MAX } from './local-game.constants';

export const isPositionOccupiedByAnotherActivePlayer = (
    session: GameSessionSnapshot,
    position: Vec2,
    playerId: string,
): boolean => {
    return session.players.some((player) => {
        if (player.id === playerId || !player.position) return false;
        if (player.status !== PlayerStatus.Active) return false;
        return player.position.x === position.x && player.position.y === position.y;
    });
};

export const getManhattanDistance = (from: Vec2, to: Vec2): number => {
    return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
};

export const getFacingToTarget = (from: Vec2, to: Vec2): 'front' | 'right' | 'back' | 'left' => {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        return deltaX >= 0 ? 'right' : 'left';
    }
    return deltaY >= 0 ? 'front' : 'back';
};

export const setTransientPose = (player: GamePlayerState, pose: 'walk' | 'attack', durationMs: number): void => {
    player.pose = pose;
    player.poseStartedAt = new Date().toISOString();
    player.poseDurationMs = durationMs;
};

export const rollCombatDie = (die: GamePlayerState['dice']['attack']): number => {
    const maxValue = die === 'D6' ? D6_MAX : D4_MAX;
    return Math.floor(Math.random() * maxValue) + 1;
};
