import { AvatarId, Die } from '../character/character.model';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '../maps/map.enums';
import { EditorCell, MapObject, Vec2 } from '../maps/map.interface';
import { PlayerRenderState } from '../player/player.interface';

export type MatchTeamId = 'A' | 'B';
export type MatchPlayerController = 'human';
export type MatchFlagTransferKind = 'offer' | 'request';
export type MatchSanctuaryChoice = 'normal' | 'double-or-nothing' | 'cancel';

export interface MatchLobbyPlayer {
    id: string;
    name: string;
    avatarId: AvatarId;
    isOrganizer: boolean;
    speed: number;
    maxHealth: number;
    baseAttack: number;
    baseDefense: number;
    attackDie: Die;
    defenseDie: Die;
    controller: MatchPlayerController;
}

export interface MatchPlayer extends MatchLobbyPlayer {
    position: Vec2;
    startingPosition: Vec2;
    teamId?: MatchTeamId | null;
    health: number;
    combatWins: number;
    attackBonus?: number;
    defenseBonus?: number;
    arenaBuffTurnsRemaining?: number;
    render?: PlayerRenderState;
}

export interface MatchObjectDetails {
    type: ObjectType;
    size: ObjectSize;
    description: string;
}

export interface MatchPlayerDetails {
    id: string;
    name: string;
    avatarId: AvatarId;
    teamId?: MatchTeamId | null;
}

export interface MatchTileInspection {
    position: Vec2;
    tileType: TileType;
    tileLabel: string;
    characteristics: string[];
    object: MatchObjectDetails | null;
    player: MatchPlayerDetails | null;
}

export interface MatchPendingFlagTransfer {
    requesterId: string;
    receiverId: string;
    kind: MatchFlagTransferKind;
}

export interface MatchEndState {
    id: string;
    winnerKind: 'player' | 'team' | 'none';
    winnerPlayerId: string | null;
    winnerTeamId?: MatchTeamId | null;
    message: string;
    resolvedAt: number;
}

export interface MatchSanctuaryState {
    objectId: number;
    cooldownTurnsRemaining: number;
}

export interface MatchPendingSanctuaryChoice {
    playerId: string;
    objectId: number;
}

export interface InitializedMatch {
    mapId: string;
    mapName: string;
    mode: GameMode;
    mapSize: MapSize;
    debugMode: boolean;
    map: EditorCell[];
    objects: MapObject[];
    allObjects: MapObject[];
    allStartingPoints: Vec2[];
    players: MatchPlayer[];
    flagCarrierId?: string | null;
    pendingFlagTransfer?: MatchPendingFlagTransfer | null;
    sanctuaryStates?: MatchSanctuaryState[];
    pendingSanctuaryChoice?: MatchPendingSanctuaryChoice | null;
    endState?: MatchEndState | null;
}
