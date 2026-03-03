import { Die } from '../character/character.model';
import { Vec2 } from '../maps/map.interface';

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

export interface Player {
    id: string;
    socketId: string;
    information: PlayerInformation;
    state: PlayerState;
}