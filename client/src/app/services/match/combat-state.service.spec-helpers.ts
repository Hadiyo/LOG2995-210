import { AvatarId } from '@common/character/character.model';
import { CombatPlayerStatistics, CombatWaitingSnapshot } from '@common/combat/combat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, MapSize, TileType } from '@common/maps/map.enums';
import { EditorCell } from '@common/maps/map.interface';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { CombatResultPayload, CombatTiePayload } from './combat-state.models';

const FAST_SPEED = 8;
const DEFAULT_SPEED = 6;
const STARTING_HEALTH = 6;
const ACTIVE_TURN_MS = 9000;
const TRANSITION_TURN_MS = 3000;

const createGrid = (): EditorCell[] =>
    Array.from({ length: MapSize.S * MapSize.S }, (_, index) => ({
        position: { x: index % MapSize.S, y: Math.floor(index / MapSize.S) },
        tileType: TileType.WATER,
        isWalkable: true,
        isOccupied: false,
    }));

const createPlayer = (
    id: string,
    name: string,
    speed: number,
    position: { x: number; y: number },
    avatarId: AvatarId,
): MatchPlayer => ({
    id,
    name,
    avatarId,
    isOrganizer: id === 'attacker',
    speed,
    maxHealth: STARTING_HEALTH,
    baseAttack: 4,
    baseDefense: 4,
    attackDie: 'D6',
    defenseDie: 'D4',
    controller: 'human',
    position,
    startingPosition: position,
    health: STARTING_HEALTH,
    combatWins: 0,
    render: { facing: PlayerFacing.Front, pose: PlayerPose.Idle },
});

export const createPlayers = (): MatchPlayer[] => [
    createPlayer('attacker', 'Attacker', FAST_SPEED, { x: 1, y: 1 }, 0),
    createPlayer('defender', 'Defender', DEFAULT_SPEED, { x: 2, y: 1 }, 1),
];

export const createMatch = (mode: GameMode = GameMode.CLASSIC): InitializedMatch => ({
    mapId: 'map-1',
    mapName: 'Arena',
    mode,
    mapSize: MapSize.S,
    debugMode: false,
    map: createGrid(),
    objects: [],
    allObjects: [],
    allStartingPoints: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    players: createPlayers(),
});

export const createSpectatorMatch = (): InitializedMatch => ({
    ...createMatch(),
    players: [
        ...createPlayers(),
        createPlayer('spectator', 'Spectator', DEFAULT_SPEED, { x: 3, y: 1 }, 2),
    ],
});

export const createCombatTurnState = (
    activePlayerId: string | null,
    currentTurnIndex: number,
    phase: MatchTurnState['phase'] = 'active',
): MatchTurnState => ({
    matchId: 'combat-1',
    hasStarted: true,
    order: [
        { playerId: 'attacker', speed: FAST_SPEED },
        { playerId: 'defender', speed: DEFAULT_SPEED },
    ],
    currentTurnIndex,
    phase,
    activePlayerId,
    transitionTargetPlayerId: phase === 'transition' ? 'attacker' : null,
    transitionEndsAt: phase === 'transition' ? Date.now() + TRANSITION_TURN_MS : null,
    transitionRemainingMs: phase === 'transition' ? TRANSITION_TURN_MS : 0,
    activeTurnEndsAt: phase === 'active' ? Date.now() + ACTIVE_TURN_MS : null,
    activeTurnRemainingMs: phase === 'active' ? ACTIVE_TURN_MS : 0,
    movementPointsRemaining: 0,
    actionTaken: false,
    movementCount: 0,
    playerStates: [
        { playerId: 'attacker', state: activePlayerId === 'attacker' ? 'active' : 'waiting' },
        { playerId: 'defender', state: activePlayerId === 'defender' ? 'active' : 'waiting' },
    ],
});

export const createLocalPlayer = (): MatchLobbyPlayer => ({
    id: 'attacker',
    name: 'Attacker',
    avatarId: 0,
    speed: FAST_SPEED,
    maxHealth: STARTING_HEALTH,
    baseAttack: 4,
    baseDefense: 4,
    attackDie: 'D6',
    defenseDie: 'D4',
    isOrganizer: true,
    controller: 'human',
});

export const createSpectatorLocalPlayer = (): MatchLobbyPlayer => ({
    ...createLocalPlayer(),
    id: 'spectator',
    name: 'Spectator',
    avatarId: 2,
    isOrganizer: false,
});

export const createCombatVictoryPayload = (overrides: Partial<CombatResultPayload> = {}): CombatResultPayload => ({
    winner: 'attacker',
    loser: 'defender',
    ...overrides,
});

export const createCombatTiePayload = (overrides: Partial<CombatTiePayload> = {}): CombatTiePayload => ({
    player1: 'attacker',
    player2: 'defender',
    ...overrides,
});

export const createCombatWaitingSnapshot = (
    overrides: Partial<CombatWaitingSnapshot> = {},
): CombatWaitingSnapshot => ({
    combatId: 'combat-1',
    gameSessionId: 'session-1',
    attackerId: 'attacker',
    defenderId: 'defender',
    activePlayerId: 'attacker',
    phase: 'active',
    round: 1,
    countdownSeconds: 8,
    ...overrides,
});

export function createAttackStatistics(): CombatPlayerStatistics[] {
    return [
        {
            attacker: { id: 'attacker', health: 5 },
            victim: { id: 'defender', health: 3 },
            attackRoll: 4,
            defenseRoll: 1,
            attack: 10,
            defense: 7,
        },
        {
            attacker: { id: 'defender', health: 3 },
            victim: { id: 'attacker', health: 5 },
            attackRoll: 2,
            defenseRoll: 1,
            attack: 6,
            defense: 5,
        },
    ];
}

export function createLethalAttackStatistics(): CombatPlayerStatistics[] {
    return [
        {
            attacker: { id: 'attacker', health: 5 },
            victim: { id: 'defender', health: 0 },
            attackRoll: 4,
            defenseRoll: 1,
            attack: 10,
            defense: 3,
        },
        {
            attacker: { id: 'defender', health: 0 },
            victim: { id: 'attacker', health: 5 },
            attackRoll: 1,
            defenseRoll: 1,
            attack: 5,
            defense: 5,
        },
    ];
}