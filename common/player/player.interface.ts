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

export interface Player {
    id: string;
    name: string;
    avatarId: string;
    wins: number;
    isOrganizer: boolean;
    health: number;
    dices: PlayerDice;
    attributes: PlayerAttributes;
    position: Vec2;
    remainingMovements: number;
    remainingActions: number;
}