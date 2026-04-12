import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { MapApiService } from '@app/services/map/map-api.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { AvatarId } from '@common/character/character.model';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { MatchTurnState } from '@common/game/turn.interface';
import { GameMode, MapSize, TileType } from '@common/maps/map.enums';
import { EditorCell } from '@common/maps/map.interface';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { CombatSocketEvents, SessionSocketEvents } from '@common/socket-events';
import { CombatStateService } from './combat-state.service';
import { MatchStateService } from './match-state.service';
import { TurnStateService } from './turn-state.service';

const FAST_SPEED = 8;
const DEFAULT_SPEED = 6;
const STARTING_HEALTH = 6;
const ACTIVE_TURN_MS = 9000;
const TRANSITION_TURN_MS = 3000;
const DICE_ROLL_DURATION_MS = 1000;
const ATTACK_POSE_DURATION_MS = 900;
const HIT_REACTION_DURATION_MS = 280;
const OUTCOME_RESOLUTION_GRACE_MS = 500;
const COMBAT_END_DEAD_FRAME_MS = 1000;
const COMBAT_END_LINGER_MS = 1000;

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

const createSpectatorMatch = (): InitializedMatch => ({
    ...createMatch(),
    players: [
        ...createPlayers(),
        createPlayer('spectator', 'Spectator', DEFAULT_SPEED, { x: 3, y: 1 }, 2),
    ],
});

const createCombatTurnState = (
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

const createSpectatorLocalPlayer = (): MatchLobbyPlayer => ({
    ...createLocalPlayer(),
    id: 'spectator',
    name: 'Spectator',
    avatarId: 2,
    isOrganizer: false,
});

describe('CombatStateService', () => {
    let service: CombatStateService;
    let gameSessionSocketService: Pick<GameSessionSocketService, 'sessionId'>;
    let matchStateService: MatchStateService;
    let socketManager: jasmine.SpyObj<SocketManagerService>;
    let listeners: Map<string, (payload: unknown) => void>;

    beforeEach(() => {
        localStorage.clear();
        listeners = new Map<string, (payload: unknown) => void>();
        socketManager = jasmine.createSpyObj<SocketManagerService>('SocketManagerService', ['on', 'send']);
        gameSessionSocketService = {
            sessionId: signal<string | null>('session-1'),
        };
        socketManager.on.and.callFake(<T>(event: string, handler: (payload: T) => void) => {
            listeners.set(event, handler as (payload: unknown) => void);
        });

        TestBed.configureTestingModule({
            providers: [
                MatchStateService,
                TurnStateService,
                CombatStateService,
                { provide: GameSessionSocketService, useValue: gameSessionSocketService },
                { provide: SocketManagerService, useValue: socketManager },
                { provide: MapApiService, useValue: jasmine.createSpyObj<MapApiService>('MapApiService', ['getMapById']) },
            ],
        });

        service = TestBed.inject(CombatStateService);
        matchStateService = TestBed.inject(MatchStateService);
        matchStateService.localPlayer.set(createLocalPlayer());
    });

    afterEach(() => {
        service.closeCombat();
        localStorage.clear();
    });

    it('opens the combat panel from a backend turn snapshot', () => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));

        const panelState = service.panelState();
        expect(service.hasActiveCombat()).toBeTrue();
        expect(panelState?.id).toBe('combat-1');
        expect(panelState?.orientation).toBe('horizontal');
        expect(panelState?.fighters.map((fighter) => fighter.name)).toEqual(['Attacker', 'Defender']);
        expect(panelState?.fighters[0].facing).toBe(PlayerFacing.Right);
        expect(panelState?.fighters[1].facing).toBe(PlayerFacing.Left);
        expect(panelState?.fighters[0].isLocal).toBeTrue();
        expect(panelState?.fighters[0].tileType).toBe(TileType.WATER);
        expect(panelState?.countdownSeconds).toBe(9);
        expect(service.canSelectStance()).toBeTrue();
        expect(service.roundLogs()[0].status).toBe('pending');
    });

    it('sends the chosen stance to the combat socket and updates the pending log', () => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        service.selectStance('attack');

        expect(service.localSelectedStance()).toBe('attack');
        expect(service.footerMessage()).toContain('offensive');
        expect(service.roundLogs()[0].fighters[0].stance).toBe('attack');
        expect(socketManager.send).toHaveBeenCalledWith(
            CombatSocketEvents.SetStance,
            jasmine.objectContaining({ combatId: 'combat-1', playerId: 'attacker', stance: 'attack' }),
        );
    });

    it('resolves backend attack statistics into a round log and updates fighter health', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        service.selectStance('attack');
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, createAttackStatistics());

        const resolvedRound = service.roundLogs()[0];
        expect(resolvedRound.status).toBe('resolved');
        expect(resolvedRound.fighters[0].stance).toBe('attack');
        expect(resolvedRound.fighters[0].attack.postureBonus).toBe(2);
        expect(resolvedRound.fighters[1].stance).toBe('defense');
        expect(resolvedRound.fighters[1].defense.postureBonus).toBe(2);
        expect(resolvedRound.fighters[0].damage).toBe(3);
        expect(service.panelState()?.fighters[0].pose).toBe(PlayerPose.Idle);
        expect(service.panelState()?.fighters[0].attackRollValue).toBe(4);
        expect(service.canSelectStance()).toBeFalse();

        tick(DICE_ROLL_DURATION_MS);

        expect(service.panelState()?.fighters[0].pose).toBe(PlayerPose.Attack);
        expect(service.panelState()?.fighters[1].isDefending).toBeTrue();

        tick(ATTACK_POSE_DURATION_MS);

        expect(service.panelState()?.fighters[1].isHit).toBeTrue();

        tick(HIT_REACTION_DURATION_MS);

        const panelState = service.panelState();
        expect(panelState?.fighters[0].currentHealth).toBe(5);
        expect(panelState?.fighters[1].currentHealth).toBe(3);
        expect(panelState?.round).toBe(2);
        expect(service.localSelectedStance()).toBeNull();
        expect(service.canSelectStance()).toBeTrue();
    }));

    it('keeps the panel open briefly before storing a victory notice when combat ends', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.Victory, { winner: 'attacker', loser: 'defender' });

        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(OUTCOME_RESOLUTION_GRACE_MS + COMBAT_END_DEAD_FRAME_MS);
        expect(service.endingNotice()?.attackerMessage).toContain('Victoire contre Defender');

        tick(COMBAT_END_LINGER_MS);

        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.panelState()).toBeNull();
        expect(service.lastCombatOutcome()?.attackerMessage).toContain('Victoire contre Defender');
    }));

    it('shows a waiting combat panel for non-participants and clears it on combat end', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());

        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, {
            combatId: 'combat-1',
            gameSessionId: 'session-1',
            attackerId: 'attacker',
            defenderId: 'defender',
            activePlayerId: 'attacker',
            phase: 'active',
            round: 3,
            countdownSeconds: 6,
        });

        expect(service.hasWaitingCombat()).toBeTrue();
        expect(service.waitingState()).toEqual(jasmine.objectContaining({
            gameSessionId: 'session-1',
            attackerName: 'Attacker',
            defenderName: 'Defender',
            activePlayerName: 'Attacker',
            phase: 'active',
            round: 3,
            countdownSeconds: 6,
        }));

        emitSocketEvent(SessionSocketEvents.CombatVictory, { winner: 'attacker', loser: 'defender' });

        expect(service.hasWaitingCombat()).toBeFalse();
        expect(service.waitingState()).toBeNull();
    });

    it('ignores waiting combat snapshots from another session', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());

        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, {
            combatId: 'combat-1',
            gameSessionId: 'old-session',
            attackerId: 'attacker',
            defenderId: 'defender',
            activePlayerId: 'attacker',
            phase: 'active',
            round: 3,
            countdownSeconds: 6,
        });

        expect(service.hasWaitingCombat()).toBeFalse();
        expect(service.waitingState()).toBeNull();
    });

    it('waits for the lethal round animation before closing the combat panel', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, createLethalAttackStatistics());
        emitSocketEvent(CombatSocketEvents.Victory, { winner: 'attacker', loser: 'defender' });

        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(DICE_ROLL_DURATION_MS + ATTACK_POSE_DURATION_MS);
        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(HIT_REACTION_DURATION_MS);
        expect(service.panelState()?.fighters[1].pose).toBe(PlayerPose.Dead);
        expect(service.endingNotice()).toBeNull();

        tick(COMBAT_END_DEAD_FRAME_MS);
        expect(service.endingNotice()?.attackerMessage).toContain('Victoire contre Defender');

        tick(COMBAT_END_LINGER_MS);
        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.lastCombatOutcome()?.attackerMessage).toContain('Victoire contre Defender');
    }));

    function emitSocketEvent<T>(event: string, payload: T): void {
        const listener = listeners.get(event);
        expect(listener).withContext(`Missing listener for ${event}`).toBeDefined();
        listener?.(payload);
    }

    function createAttackStatistics(): CombatPlayerStatistics[] {
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

    function createLethalAttackStatistics(): CombatPlayerStatistics[] {
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
});
