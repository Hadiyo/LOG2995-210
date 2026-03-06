import { Die } from '../character/character.model';
import { Vec2 } from '../maps/map.interface';

// // Represents the status of a player in the game session
// export enum PlayerStatus {
//     Active = 'ACTIVE',
//     Surrendered = 'SURRENDERED', // When the player quit voluntarily
//     Eliminated = 'ELIMINATED', // When the player is defeated
// }

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

// // Immutable identity data for a player across the whole match/session.
// export interface PlayerIdentity {
//     id: string;
//     name: string;
//     avatarId: AvatarId;
//     isOrganizer: boolean;
// }

// // Match progression counters that evolve during gameplay.
// export interface PlayerProgress {
//     // Keep this as an interface for future extensibility...
//     wins: number;
// }

// // Combat-related stats and resources used by attack/defense resolution.
// export interface PlayerCombatProfile {
//     health: PlayerHealth;
//     attributes: PlayerAttributes;
//     dice: PlayerDice;
// }

// // Participation state in the current session (alive/surrendered/eliminated + board presence).
// export interface PlayerParticipationState {
//     status: PlayerStatus;
//     position?: Vec2;
// }

// // Turn-scoped resources consumed by movement and actions.
// export interface PlayerTurnResources {
//     remainingMovement: number;
//     remainingActions: number;
// }

// Renderer metadata synchronized to clients for facing/pose display.
export interface PlayerRenderState {
    facing?: PlayerFacing;
    pose?: PlayerPose;
    poseStartedAt?: string;
    poseDurationMs?: number;
}

export interface Player {
    id: string;
    information: PlayerInformation;
    state: PlayerState;
    render?: PlayerRenderState;
}

