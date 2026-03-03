import { Die } from '../character/character.model';
import { Vec2 } from '../maps/map.interface';

// Facing orientation used by the renderer.
export type PlayerFacing = 'front' | 'right' | 'back' | 'left';

// Pose/state used by the renderer.
export type PlayerPose = 'idle' | 'walk' | 'attack' | 'dead';


export interface PlayerAttributes {
    speed: number;
    attack: number;
    defense: number;
}

// Dice assigned to a player for attack and defense rolls
export interface PlayerDice {
    attack: Die;
    defense: Die;
}

export interface PlayerInformation {
    name: string;
    avatarId: string;
    isOrganizer: boolean;
    dices: PlayerDice;
    attributes: PlayerAttributes;
}

export interface PlayerState {
    position: Vec2;
    health: number;
    wins: number;
    remainingActions: number;
    remainingMovements: number;
}

export interface PlayerRenderState {
    facing?: PlayerFacing;
    pose?: PlayerPose;
    poseStartedAt?: string;
    poseDurationMs?: number;
}

export interface Player {
    id: string;
    socketId: string;
    information: PlayerInformation;
    state: PlayerState;
    render?: PlayerRenderState;
}