import { AvatarId, Die } from '../character/character.model';
import { Vec2 } from '../maps/map.interface';

// Represents the status of a player in the game session
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

// Health values for a player, split into current and maximum
export interface PlayerHealth {
    current: number;
    max: number; //max is needed since health can change
}

// Base stat block that drives movement and combat calculations
export interface PlayerAttributes {
    health: number;
    maxHealth: number;
    speed: number;
    attack: number;
    defense: number;
}

// Dice assigned to a player for attack and defense rolls
export interface PlayerDice {
    attack: Die;
    defense: Die;
}

// Renderer metadata synchronized to clients for facing/pose display.
export interface PlayerRenderState {
    facing?: PlayerFacing;
    pose?: PlayerPose;
    poseStartedAt?: string;
    poseDurationMs?: number;
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
    status: PlayerStatus;
    attributes: PlayerAttributes;
    wins: number;
    remainingActions: number;
    remainingMovements: number;
}


// Player to player info to test changes
export interface Player {
    id: string;
    information: PlayerInformation;
    state: PlayerState;
    render: PlayerRenderState;
}