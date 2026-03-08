import { AvatarId, Die } from '../character/character.model';
import { Vec2 } from '../maps/map.interface';


// Represents the status of a player in the game session WEI'S
export enum PlayerStatus {
    Active = 'ACTIVE',
    Surrendered = 'SURRENDERED', // When the player quit voluntarily
    Eliminated = 'ELIMINATED', // When the player is defeated
}

// Facing orientation used by the renderer.
export type PlayerFacing = 'front' | 'right' | 'back' | 'left';

// Pose/state used by the renderer.
export type PlayerPose = 'idle' | 'walk' | 'attack' | 'dead';

export type Bonus = 'speed' | 'life';

// Dice assigned to a player for attack and defense rolls
export interface PlayerDice {
    attack: Die;
    defense: Die;
}

export interface PlayerInformation {
    name: string;
    avatarId: AvatarId;
    isOrganizer: boolean;
    dices: PlayerDice;
    bonus: Bonus;
}

export interface PlayerState {
    position: Vec2;
    health: number;
    wins: number;
    remainingActions: number;
    remainingMovements: number;
}

// Renderer metadata synchronized to clients for facing/pose display.
export interface PlayerRenderState {
    facing?: PlayerFacing;
    pose?: PlayerPose;
    poseStartedAt?: string;
    poseDurationMs?: number;
}

// Player to player info to test changes
export interface Player {
    id: string;
    information: PlayerInformation;
    state: PlayerState;
    render?: PlayerRenderState;
}

