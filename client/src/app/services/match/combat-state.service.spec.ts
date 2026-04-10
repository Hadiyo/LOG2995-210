import { TestBed } from '@angular/core/testing';
import { MapApiService } from '@app/services/map/map-api.service';
import { AvatarId } from '@common/character/character.model';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
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

const createGrid = (): EditorCell[] =>
    Array.from({ length: MapSize.S * MapSize.S }, (_, index) => ({
        position: { x: index % MapSize.S, y: Math.floor(index / MapSize.S) },
        tileType: TileType.WATER,
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

const createLocalPlayer = (): MatchLobbyPlayer => ({
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
        matchStateService.localPlayer.set(createLocalPlayer());
    });

    afterEach(() => {
        service.closeCombat();
        turnStateService.clear();
        localStorage.clear();
    });

    it('opens a horizontal combat preview without mutating the match state', () => {
        matchStateService.match.set(createMatch());
        turnStateService.turnState.set(createTurnState());

        expect(service.startCombat('attacker', 'defender')).toBeTrue();

        const panelState = service.panelState();
        expect(service.hasActiveCombat()).toBeTrue();
        expect(panelState?.orientation).toBe('horizontal');
        expect(panelState?.fighters.map((fighter) => fighter.name)).toEqual(['Attacker', 'Defender']);
        expect(panelState?.fighters[0].facing).toBe(PlayerFacing.Right);
        expect(panelState?.fighters[1].facing).toBe(PlayerFacing.Left);
        expect(panelState?.fighters[0].isLocal).toBeTrue();
        expect(panelState?.fighters[0].tileType).toBe(TileType.WATER);
        expect(turnStateService.turnState()?.actionTaken).toBeFalse();
        expect(matchStateService.match()?.players.find((player) => player.id === 'attacker')?.combatWins).toBe(0);
    });

    it('opens a vertical combat preview when the fighters are stacked', () => {
        const match = createMatch();
        match.players[1].position = { x: 1, y: 2 };
        matchStateService.match.set(match);
        turnStateService.turnState.set(createTurnState());

        expect(service.startCombat('attacker', 'defender')).toBeTrue();

        const panelState = service.panelState();
        expect(panelState?.orientation).toBe('vertical');
        expect(panelState?.fighters[0].facing).toBe(PlayerFacing.Right);
        expect(panelState?.fighters[1].facing).toBe(PlayerFacing.Left);
    });

    it('stores the selected local stance and clears the preview cleanly', () => {
        matchStateService.match.set(createMatch());
        turnStateService.turnState.set(createTurnState());
        service.startCombat('attacker', 'defender');

        service.selectStance('attack');
        expect(service.localSelectedStance()).toBe('attack');
        expect(service.footerMessage()).toContain('offensive');

        service.closeCombat();
        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.panelState()).toBeNull();
        expect(service.localSelectedStance()).toBeNull();
    });
});
