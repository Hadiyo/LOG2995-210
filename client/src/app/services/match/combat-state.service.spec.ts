import { TestBed } from '@angular/core/testing';
import { MapApiService } from '@app/services/map/map-api.service';
import { AvatarId } from '@common/character/character.model';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, MapSize, TileType } from '@common/maps/map.enums';
import { EditorCell } from '@common/maps/map.interface';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { CombatStateService } from './combat-state.service';
import { MatchStateService } from './match-state.service';
import { TurnStateService } from './turn-state.service';

const FAST_SPEED = 8;
const DEFAULT_SPEED = 6;
const STARTING_HEALTH = 6;
const ACTIVE_TURN_MS = 30000;
const WIN_THRESHOLD = 3;

const createGrid = (): EditorCell[] =>
    Array.from({ length: MapSize.S * MapSize.S }, (_, index) => ({
        position: { x: index % MapSize.S, y: Math.floor(index / MapSize.S) },
        tileType: TileType.DIRT,
        isWalkable: true,
        isOccupied: false,
    }));

const createPlayers = (): MatchPlayer[] => [
    createPlayer('attacker', 'Attacker', FAST_SPEED, { x: 1, y: 1 }, 0),
    createPlayer('defender', 'Defender', DEFAULT_SPEED, { x: 2, y: 1 }, 1),
];

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

const createMatch = (mode: GameMode = GameMode.CLASSIC): InitializedMatch => ({
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

const createTurnState = (): MatchTurnState => ({
    matchId: 'map-1',
    hasStarted: true,
    order: [
        { playerId: 'attacker', speed: FAST_SPEED },
        { playerId: 'defender', speed: DEFAULT_SPEED },
    ],
    currentTurnIndex: 0,
    phase: 'active',
    activePlayerId: 'attacker',
    transitionTargetPlayerId: null,
    transitionEndsAt: null,
    transitionRemainingMs: 0,
    activeTurnEndsAt: Date.now() + ACTIVE_TURN_MS,
    activeTurnRemainingMs: ACTIVE_TURN_MS,
    movementPointsRemaining: 3,
    actionTaken: false,
    movementCount: 0,
    playerStates: [
        { playerId: 'attacker', state: 'active' },
        { playerId: 'defender', state: 'waiting' },
    ],
});

describe('CombatStateService', () => {
    let service: CombatStateService;
    let matchStateService: MatchStateService;
    let turnStateService: TurnStateService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [
                MatchStateService,
                TurnStateService,
                CombatStateService,
                { provide: MapApiService, useValue: jasmine.createSpyObj<MapApiService>('MapApiService', ['getMapById']) },
            ],
        });

        service = TestBed.inject(CombatStateService);
        matchStateService = TestBed.inject(MatchStateService);
        turnStateService = TestBed.inject(TurnStateService);
    });

    afterEach(() => {
        turnStateService.clear();
        localStorage.clear();
    });

    it('resolves Sprint 2 combat immediately in favour of the attacker', () => {
        matchStateService.match.set(createMatch());
        turnStateService.turnState.set(createTurnState());

        expect(service.startCombat('attacker', 'defender')).toBeTrue();
        expect(turnStateService.turnState()?.phase).toBe('active');
        expect(turnStateService.turnState()?.actionTaken).toBeTrue();
        expect(matchStateService.match()?.players.find((player) => player.id === 'attacker')?.combatWins).toBe(1);
        expect(matchStateService.match()?.players.find((player) => player.id === 'defender')?.health).toBe(STARTING_HEALTH);
        expect(service.lastCombatOutcome()?.attackerMessage).toContain('Victoire contre Defender');
    });

    it('stores the combat update and respawns the defender', () => {
        matchStateService.match.set(createMatch());
        turnStateService.turnState.set(createTurnState());
        matchStateService.match.update((match) =>
            match ? {
                ...match,
                players: match.players.map((player) =>
                    player.id === 'defender' ? { ...player, startingPosition: { x: STARTING_HEALTH, y: STARTING_HEALTH } } : player,
                ),
            } : match,
        );

        expect(service.startCombat('attacker', 'defender')).toBeTrue();

        expect(service.lastCombatUpdate()).toContain('Attacker gagne contre Defender');
        expect(service.lastCombatOutcome()?.defenderMessage).toContain('Defaite contre Attacker');
        expect(matchStateService.match()?.players.find((player) => player.id === 'defender')?.position)
            .toEqual({ x: STARTING_HEALTH, y: STARTING_HEALTH });
    });

    it('ends the match when the attacker reaches the third combat win', () => {
        const match = createMatch();
        match.players[0].combatWins = WIN_THRESHOLD - 1;
        matchStateService.match.set(match);
        turnStateService.turnState.set(createTurnState());

        service.startCombat('attacker', 'defender');

        expect(matchStateService.match()?.players.find((player) => player.id === 'attacker')?.combatWins).toBe(WIN_THRESHOLD);
        expect(matchStateService.match()?.endState?.winnerKind).toBe('player');
        expect(matchStateService.match()?.endState?.winnerPlayerId).toBe('attacker');
        expect(matchStateService.match()?.endState?.message).toContain('Attacker remporte la partie');
    });

});
