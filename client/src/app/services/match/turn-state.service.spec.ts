import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AvatarId } from '@common/character/character.model';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { TurnStateService } from './turn-state.service';

const FAST_SPEED = 8;
const SLOW_SPEED = 6;
const TRANSITION_MS = 3000;
const ACTIVE_TURN_MS = 30000;
const PERSISTED_ACTIVE_TURN_MS = 24000;
const MOVEMENT_COST = 1;
const DOUBLE_MOVEMENT_COST = 2;
const REMAINING_MOVEMENT_POINTS = 5;

const createPlayers = (): MatchPlayer[] => [
    createPlayer('player-1', 'Alpha', FAST_SPEED, { x: 1, y: 1 }, 0),
    createPlayer('player-2', 'Bravo', FAST_SPEED, { x: 3, y: 1 }, 1),
    createPlayer('player-3', 'Charlie', SLOW_SPEED, { x: 5, y: 1 }, 2),
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
    isOrganizer: id === 'player-1',
    speed,
    maxHealth: 6,
    baseAttack: 4,
    baseDefense: 4,
    attackDie: 'D6',
    defenseDie: 'D4',
    controller: 'human',
    position,
    startingPosition: position,
    health: 6,
    combatWins: 0,
    render: { facing: 'front', pose: 'idle' },
});

const createMatch = (): InitializedMatch => ({
    mapId: 'map-1',
    mapName: 'Arena',
    mode: GameMode.CLASSIC,
    mapSize: MapSize.S,
    debugMode: false,
    map: [],
    objects: [],
    allObjects: [],
    allStartingPoints: [],
    players: createPlayers(),
});

const createPersistedActiveState = () => ({
    matchId: 'map-1',
    hasStarted: true,
    order: [
        { playerId: 'player-2', speed: FAST_SPEED },
        { playerId: 'player-1', speed: FAST_SPEED },
        { playerId: 'player-3', speed: SLOW_SPEED },
    ],
    currentTurnIndex: 1,
    phase: 'active' as const,
    activePlayerId: 'player-1',
    transitionTargetPlayerId: null,
    transitionEndsAt: null,
    transitionRemainingMs: 0,
    activeTurnEndsAt: null,
    activeTurnRemainingMs: PERSISTED_ACTIVE_TURN_MS,
    movementPointsRemaining: 4,
    actionTaken: true,
    movementCount: 2,
    playerStates: [
        { playerId: 'player-2', state: 'waiting' as const },
        { playerId: 'player-1', state: 'active' as const },
        { playerId: 'player-3', state: 'waiting' as const },
    ],
});

describe('TurnStateService', () => {
    let service: TurnStateService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({});
        service = TestBed.inject(TurnStateService);
    });

    afterEach(() => {
        service.clear();
    });

    it('builds a stable speed-based order and randomizes only tied players', () => {
        const order = service.buildTurnOrder(createPlayers(), () => 0);

        expect(order.map((entry: { playerId: string }) => entry.playerId)).toEqual(['player-2', 'player-1', 'player-3']);
        expect(order.map((entry: { speed: number }) => entry.speed)).toEqual([FAST_SPEED, FAST_SPEED, SLOW_SPEED]);
    });

    it('starts with a transition countdown, then activates the current player', fakeAsync(() => {
        service.initialize(createMatch(), () => 0.9);

        expect(service.turnState()?.phase).toBe('transition');
        expect(service.turnState()?.transitionTargetPlayerId).toBe('player-1');
        expect(service.canPlayerInteract('player-1', 'inspection')).toBeTrue();

        tick(TRANSITION_MS);

        expect(service.turnState()?.phase).toBe('active');
        expect(service.turnState()?.hasStarted).toBeTrue();
        expect(service.turnState()?.activePlayerId).toBe('player-1');
        expect(service.turnState()?.activeTurnRemainingMs).toBe(ACTIVE_TURN_MS);
        expect(service.turnState()?.movementPointsRemaining).toBe(FAST_SPEED);
    }));

    it('tracks movement and enforces a single action per active turn', fakeAsync(() => {
        service.initialize(createMatch(), () => 0.9);
        tick(TRANSITION_MS);

        expect(service.recordMovement('player-1', MOVEMENT_COST)).toBeTrue();
        expect(service.recordMovement('player-1', DOUBLE_MOVEMENT_COST)).toBeTrue();
        expect(service.consumeAction('player-1')).toBeTrue();
        expect(service.consumeAction('player-1')).toBeFalse();

        expect(service.turnState()?.movementCount).toBe(2);
        expect(service.turnState()?.movementPointsRemaining).toBe(REMAINING_MOVEMENT_POINTS);
        expect(service.turnState()?.actionTaken).toBeTrue();
    }));

    it('allows inspection at any time for non-active players', fakeAsync(() => {
        service.initialize(createMatch(), () => 0.9);
        tick(TRANSITION_MS);

        expect(service.canPlayerInteract('player-2')).toBeFalse();
        expect(service.canPlayerInteract('player-2', 'inspection')).toBeTrue();
    }));

    it('moves to the next player on timeout and on explicit early turn end', fakeAsync(() => {
        service.initialize(createMatch(), () => 0.9);
        tick(TRANSITION_MS);

        service.advanceToNextTurn();
        expect(service.turnState()?.phase).toBe('transition');
        expect(service.turnState()?.transitionTargetPlayerId).toBe('player-2');

        tick(TRANSITION_MS);
        tick(ACTIVE_TURN_MS);

        expect(service.turnState()?.phase).toBe('transition');
        expect(service.turnState()?.transitionTargetPlayerId).toBe('player-3');
    }));

    it('reuses a persisted active state for the same match roster', () => {
        localStorage.setItem('pendingMatchTurnState', JSON.stringify(createPersistedActiveState()));

        const reloadedService = TestBed.runInInjectionContext(() => new TurnStateService());
        reloadedService.initialize(createMatch(), () => 0);

        expect(reloadedService.turnState()?.currentTurnIndex).toBe(1);
        expect(reloadedService.turnState()?.phase).toBe('active');
        expect(reloadedService.turnState()?.movementCount).toBe(2);
        expect(reloadedService.turnState()?.actionTaken).toBeTrue();
    });

    it('starts fresh if persisted state has an unknown phase', () => {
        const persistedUnknownPhase = {
            ...createPersistedActiveState(),
            phase: 'unknown-phase',
        };
        localStorage.setItem('pendingMatchTurnState', JSON.stringify(persistedUnknownPhase));

        const reloadedService = TestBed.runInInjectionContext(() => new TurnStateService());
        reloadedService.initialize(createMatch(), () => 0.9);

        expect(reloadedService.turnState()?.phase).toBe('transition');
        expect(reloadedService.turnState()?.hasStarted).toBeFalse();
    });
});
