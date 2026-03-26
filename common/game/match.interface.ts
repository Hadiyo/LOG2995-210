import { AvatarId, Die } from '../character/character.model';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '../maps/map.enums';
import { EditorCell, MapObject, Vec2 } from '../maps/map.interface';
import { PlayerRenderState } from '../player/player.interface';

export type MatchPlayerController = 'human';

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
    health: number;
    combatWins: number;
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
}

export interface MatchTileInspection {
    position: Vec2;
    tileType: TileType;
    tileLabel: string;
    characteristics: string[];
    object: MatchObjectDetails | null;
    player: MatchPlayerDetails | null;
}

export interface MatchEndState {
    id: string;
    winnerKind: 'player' | 'none';
    winnerPlayerId: string | null;
    message: string;
    resolvedAt: number;
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
    endState?: MatchEndState | null;
}
