import { AvatarId, Die } from '../character/character.model';
import type { MatchTeamId } from '../game/match.interface';
import { Vec2 } from '../maps/map.interface';

// Represents the status of a player in the game session
export enum PlayerStatus {
    Active = 'ACTIVE',
    Surrendered = 'SURRENDERED', // When the player quit voluntarily
    Eliminated = 'ELIMINATED', // When the player is defeated
}

// Facing orientation used by the renderer.
export enum PlayerFacing {
    Front = 'front',
    Right = 'right',
    Back = 'back',
    Left = 'left',
}

// Pose/state used by the renderer.
export enum PlayerPose {
    Idle = 'idle',
    Walk = 'walk',
    Attack = 'attack',
    Dead = 'dead',
}

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
    teamId?: MatchTeamId | null;
    dices: PlayerDice;
    bonus: Bonus;
}

export interface PlayerState {
    position: Vec2;
    status: PlayerStatus;
    attributes: PlayerAttributes;
    wins: number;
    hasFlag?: boolean;
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
