import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { TileType } from '@common/maps/map.enums';
import {
    CombatOutcomeNotice,
    CombatPanelFighter,
    CombatPanelState,
    CombatStanceChoice,
} from './combat-state.models';

export interface CombatFooterMessageOptions {
    canSelectStance: boolean;
    endingNotice: CombatOutcomeNotice | null;
    hasActiveCombat: boolean;
    isResolvingRound: boolean;
    selectedStance: CombatStanceChoice;
}

export interface CombatPanelStateFromTurnSnapshotOptions {
    currentPanelState: CombatPanelState | null;
    keepAnimatedPose: boolean;
    localPlayerId: string | null;
    match: InitializedMatch;
    turnState: MatchTurnState;
}

export interface CombatPanelFighterOptions {
    player: MatchPlayer;
    index: number;
    localPlayerId: string | null;
    currentHealth: number;
    previousFighter: CombatPanelFighter | null;
    tileType: TileType;
    isDoorOpen: boolean;
    keepAnimatedPose: boolean;
}