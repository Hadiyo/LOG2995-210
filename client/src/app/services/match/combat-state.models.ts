import { AvatarId, Die } from '@common/character/character.model';
import { TileType } from '@common/maps/map.enums';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';

export interface CombatOutcomeNotice {
    id: string;
    attackerId: string;
    defenderId: string;
    attackerMessage: string;
    defenderMessage: string;
    logMessage: string;
}

export interface CombatResultPayload {
    loser: string;
    winner: string;
}

export interface CombatTiePayload {
    player1: string;
    player2: string;
}

export interface CombatWaitingState {
    combatId: string;
    gameSessionId: string;
    attackerId: string;
    defenderId: string;
    activePlayerId: string | null;
    attackerName: string;
    defenderName: string;
    activePlayerName: string | null;
    phase: 'active' | 'transition';
    round: number;
    countdownSeconds: number;
}

export type CombatStanceChoice = 'attack' | 'defense' | null;
export type CombatPanelOrientation = 'horizontal' | 'vertical';

export interface CombatPanelFighter {
    id: string;
    name: string;
    avatarId: AvatarId;
    attackDie: Die;
    defenseDie: Die;
    attackRollValue: number | null;
    defenseRollValue: number | null;
    rollToken: number;
    baseAttack: number;
    baseDefense: number;
    currentHealth: number;
    maxHealth: number;
    tileType: TileType;
    isDoorOpen: boolean;
    facing: PlayerFacing;
    pose: PlayerPose;
    isDefending: boolean;
    isHit: boolean;
    teamId: string | null;
    isLocal: boolean;
}

export interface CombatPanelState {
    id: string;
    attackerId: string;
    defenderId: string;
    orientation: CombatPanelOrientation;
    round: number;
    countdownSeconds: number;
    fighters: [CombatPanelFighter, CombatPanelFighter];
}

export interface CombatRoundBreakdown {
    base: number;
    postureBonus: number;
    dieType: Die;
    dieValue: number | null;
    penalty: number;
    total: number | null;
}

export interface CombatRoundFighterLog {
    fighterId: string;
    fighterName: string;
    isLocal: boolean;
    stance: CombatStanceChoice;
    attack: CombatRoundBreakdown;
    defense: CombatRoundBreakdown;
    attackDelta: number | null;
    damage: number | null;
}

export interface CombatRoundLog {
    id: string;
    round: number;
    status: 'pending' | 'resolved';
    fighters: [CombatRoundFighterLog, CombatRoundFighterLog];
}
