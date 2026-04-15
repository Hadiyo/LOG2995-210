/**
 * Test Strategy:
 *
 * These tests validate the frontend combat orchestration managed by CombatStateService,
 * including socket-driven state synchronization, round-log progression, animation timing,
 * spectator waiting state, outcome handling, and cleanup. The goal is to ensure that the
 * local combat UI remains deterministic and resilient as backend combat events arrive.
 *
 * Edge Cases Covered:
 * - Missing or invalid combat context:
 *   Verifies that turn snapshots, attack snapshots, stance selection, and outcome payloads
 *   are ignored safely when there is no active panel, no loaded match, unknown fighters,
 *   or no local player.
 *
 * - Round progression and animation sequencing:
 *   Covers pending, revealing, and resolved round logs, delayed outcome handling, lethal hits,
 *   and transitions into the next round to keep the UI aligned with the combat timeline.
 *
 * - Spectator and participant-specific behavior:
 *   Ensures the waiting panel is shown only to valid non-participants in the current session,
 *   and that it is cleared correctly on combat completion or explicit reset.
 *
 * - Reactive cleanup and disconnect paths:
 *   Verifies that participant departure, forfeit handling, and manual resets clear combat state
 *   without leaving stale timers, stale UI state, or inconsistent notices behind.
 *
 * Rationale:
 * These edge cases were selected because CombatStateService coordinates the full frontend combat
 * lifecycle. Regressions here tend to produce user-visible desynchronization, such as stale round
 * logs, incorrect waiting states, orphaned timers, or outcomes applied to the wrong local context.
 * Covering these paths keeps the combat UI deterministic and aligned with incoming backend events.
 */

import { signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { GameSessionSocketService } from '@app/services/game-session/game-session-socket.service';
import { MapApiService } from '@app/services/map/map-api.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { TileType } from '@common/maps/map.enums';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { CombatSocketEvents, SessionSocketEvents } from '@common/socket-events';
import {
    COMBAT_ATTACK_POSE_DURATION_MS,
    COMBAT_DICE_ROLL_DURATION_MS,
    COMBAT_END_DEAD_FRAME_MS,
    COMBAT_END_LINGER_MS,
    COMBAT_HIT_REACTION_DURATION_MS,
    COMBAT_OUTCOME_RESOLUTION_GRACE_MS,
    COMBAT_ROUND_RESOLUTION_DURATION_MS,
} from './combat-state.constants';
import { CombatPanelState } from './combat-state.models';
import { CombatStateService } from './combat-state.service';
import {
    createAttackStatistics,
    createCombatTiePayload,
    createCombatTurnState,
    createCombatVictoryPayload,
    createCombatWaitingSnapshot,
    createLethalAttackStatistics,
    createLocalPlayer,
    createMatch,
    createPlayers,
    createSpectatorLocalPlayer,
    createSpectatorMatch,
} from './combat-state.service.spec-helpers';
import { MatchStateService } from './match-state.service';
import { TurnStateService } from './turn-state.service';

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

    it('keeps an empty timer label and ignores stance selection when no active combat is available', () => {
        expect(service.timerLabel()).toBe('');

        service.selectStance('attack');

        expect(socketManager.send).not.toHaveBeenCalled();
        expect(service.localSelectedStance()).toBeNull();
    });

    it('computes timer labels and disables stance selection when the active turn belongs to the opponent or transition phase', () => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        expect(service.timerLabel()).toBe('Votre tour');
        expect(service.canSelectStance()).toBeTrue();

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('defender', 1));
        expect(service.timerLabel()).toBe('Tour de l’adversaire');
        expect(service.canSelectStance()).toBeFalse();

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState(null, 1, 'transition'));
        expect(service.timerLabel()).toBe('Résolution du tour');
        expect(service.canSelectStance()).toBeFalse();
    });

    it('tolerates missing local or active fighters when deriving combat labels and stance availability', () => {
        matchStateService.match.set(createMatch());
        matchStateService.localPlayer.set(null);

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('ghost', 0));

        expect(service.panelState()).not.toBeNull();
        expect(service.canSelectStance()).toBeFalse();
        expect(service.timerLabel()).toBe('Tour de l’adversaire');

        service.selectStance('attack');
        expect(socketManager.send).not.toHaveBeenCalled();
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

    it('keeps the resolved round visible until the player selects a stance for the next round', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        service.selectStance('attack');
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, createAttackStatistics());

        tick(COMBAT_DICE_ROLL_DURATION_MS + COMBAT_ATTACK_POSE_DURATION_MS + COMBAT_HIT_REACTION_DURATION_MS);

        expect(service.roundLogs().length).toBe(1);
        expect(service.roundLogs()[0].status).toBe('resolved');
        expect(service.panelState()?.round).toBe(2);

        service.selectStance('defense');

        expect(service.roundLogs().length).toBe(2);
        expect(service.roundLogs()[1].round).toBe(2);
        expect(service.roundLogs()[1].status).toBe('pending');
        expect(service.roundLogs()[1].fighters[0].stance).toBe('defense');
    }));

    it('resolves backend attack statistics into a round log and updates fighter health', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        service.selectStance('attack');
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, createAttackStatistics());

        const resolvedRound = service.roundLogs()[0];
        expect(resolvedRound.status).toBe('revealing');
        expect(resolvedRound.fighters[0].stance).toBe('attack');
        expect(resolvedRound.fighters[0].attack.postureBonus).toBe(2);
        expect(resolvedRound.fighters[1].stance).toBe('defense');
        expect(resolvedRound.fighters[1].defense.postureBonus).toBe(2);
        expect(resolvedRound.fighters[0].damage).toBe(3);
        expect(service.panelState()?.fighters[0].pose).toBe(PlayerPose.Idle);
        expect(service.panelState()?.fighters[0].attackRollValue).toBe(4);
        expect(service.canSelectStance()).toBeFalse();

        tick(COMBAT_DICE_ROLL_DURATION_MS);

        expect(service.panelState()?.fighters[0].pose).toBe(PlayerPose.Attack);
        expect(service.panelState()?.fighters[1].isDefending).toBeTrue();

        tick(COMBAT_ATTACK_POSE_DURATION_MS);

        expect(service.panelState()?.fighters[1].isHit).toBeTrue();

        tick(COMBAT_HIT_REACTION_DURATION_MS);

        const panelState = service.panelState();
        expect(service.roundLogs()[0].status).toBe('resolved');
        expect(panelState?.fighters[0].currentHealth).toBe(5);
        expect(panelState?.fighters[1].currentHealth).toBe(3);
        expect(panelState?.round).toBe(2);
        expect(service.localSelectedStance()).toBeNull();
        expect(service.canSelectStance()).toBeTrue();
    }));

    it('keeps the panel open briefly before storing a victory notice when combat ends', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.Victory, createCombatVictoryPayload());

        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(COMBAT_OUTCOME_RESOLUTION_GRACE_MS + COMBAT_END_DEAD_FRAME_MS);
        expect(service.endingNotice()?.attackerMessage).toContain('Victoire contre Defender');

        tick(COMBAT_END_LINGER_MS);

        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.panelState()).toBeNull();
        expect(service.lastCombatOutcome()?.attackerMessage).toContain('Victoire contre Defender');
    }));

    it('shows a waiting combat panel for non-participants and clears it on combat end', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());

        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, createCombatWaitingSnapshot({ round: 3, countdownSeconds: 6 }));

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

        emitSocketEvent(SessionSocketEvents.CombatVictory, createCombatVictoryPayload());

        expect(service.hasWaitingCombat()).toBeFalse();
        expect(service.waitingState()).toBeNull();
    });

    it('accepts waiting snapshots without a local player but ignores them when no current match is loaded', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(null);

        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, createCombatWaitingSnapshot());

        expect(service.waitingState()).not.toBeNull();
        expect(service.hasWaitingCombat()).toBeTrue();

        service.closeCombat();
        matchStateService.match.set(null);
        emitSocketEvent(
            SessionSocketEvents.CombatWaitingSnapshot,
            createCombatWaitingSnapshot({ combatId: 'combat-2', round: 2, countdownSeconds: 5 }),
        );

        expect(service.waitingState()).toBeNull();
    });

    it('does not expose the spectator waiting panel to combat participants', () => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, createCombatWaitingSnapshot());

        expect(service.waitingState()).not.toBeNull();
        expect(service.hasWaitingCombat()).toBeFalse();
    });

    it('ignores waiting combat snapshots from another session', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());

        emitSocketEvent(
            SessionSocketEvents.CombatWaitingSnapshot,
            createCombatWaitingSnapshot({ gameSessionId: 'old-session', round: 3, countdownSeconds: 6 }),
        );

        expect(service.hasWaitingCombat()).toBeFalse();
        expect(service.waitingState()).toBeNull();
    });

    it('ignores waiting combat snapshots when one participant is unknown in the current match', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());

        emitSocketEvent(
            SessionSocketEvents.CombatWaitingSnapshot,
            createCombatWaitingSnapshot({ attackerId: 'ghost', activePlayerId: 'defender' }),
        );

        expect(service.waitingState()).toBeNull();
    });

    it('fully resets combat and waiting state when closeCombat is called', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());
        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, createCombatWaitingSnapshot());

        matchStateService.match.set(createMatch());
        matchStateService.localPlayer.set(createLocalPlayer());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        service.selectStance('attack');

        service.closeCombat();

        expect(service.panelState()).toBeNull();
        expect(service.waitingState()).toBeNull();
        expect(service.roundLogs()).toEqual([]);
        expect(service.localSelectedStance()).toBeNull();
        expect(service.endingNotice()).toBeNull();
        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.hasWaitingCombat()).toBeFalse();
    });

    it('stores a tie notice after the combat linger when the round ends in a tie', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.Tie, createCombatTiePayload());

        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(COMBAT_OUTCOME_RESOLUTION_GRACE_MS + COMBAT_END_DEAD_FRAME_MS);
        expect(service.endingNotice()?.attackerMessage).toContain('Égalité contre Defender');

        tick(COMBAT_END_LINGER_MS);
        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.lastCombatOutcome()?.logMessage).toContain('Attacker et Defender terminent le combat à égalité');
    }));

    it('ignores tie payloads when the involved fighters cannot be resolved from the current match', () => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.Tie, createCombatTiePayload({ player1: 'ghost' }));

        expect(service.lastCombatOutcome()).toBeNull();
        expect(service.endingNotice()).toBeNull();
        expect(service.hasActiveCombat()).toBeFalse();
    });

    it('ignores combat outcomes that arrive when no match is loaded', () => {
        emitSocketEvent(CombatSocketEvents.Victory, createCombatVictoryPayload());
        emitSocketEvent(CombatSocketEvents.Tie, createCombatTiePayload());

        expect(service.lastCombatOutcome()).toBeNull();
        expect(service.endingNotice()).toBeNull();
    });

    it('stores victory results immediately when no combat panel is active', () => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.Victory, createCombatVictoryPayload());

        expect(service.lastCombatOutcome()?.attackerMessage).toContain('Victoire contre Defender');
        expect(service.lastCombatUpdate()).toContain('Attacker remporte le combat');
        expect(service.panelState()).toBeNull();
    });

    it('ignores turn snapshots without a current match or valid participants', () => {
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        expect(service.panelState()).toBeNull();

        matchStateService.match.set({ ...createMatch(), players: [createPlayers()[0]] });
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        expect(service.panelState()).toBeNull();
    });

    it('ignores attack snapshots without an active panel, without statistics, or with incomplete fighter data', () => {
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, []);
        expect(service.roundLogs()).toEqual([]);

        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, []);
        expect(service.roundLogs()[0].status).toBe('pending');

        emitSocketEvent(CombatSocketEvents.AttackSnapshot, [createAttackStatistics()[0]]);
        expect(service.roundLogs()[0].status).toBe('pending');
    });

    it('waits for the lethal round animation before closing the combat panel', fakeAsync(() => {
        matchStateService.match.set(createMatch());

        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.AttackSnapshot, createLethalAttackStatistics());
        emitSocketEvent(CombatSocketEvents.Victory, createCombatVictoryPayload());

        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(COMBAT_DICE_ROLL_DURATION_MS + COMBAT_ATTACK_POSE_DURATION_MS);
        expect(service.hasActiveCombat()).toBeTrue();
        expect(service.endingNotice()).toBeNull();

        tick(COMBAT_HIT_REACTION_DURATION_MS);
        expect(service.panelState()?.fighters[1].pose).toBe(PlayerPose.Dead);
        expect(service.endingNotice()).toBeNull();

        tick(COMBAT_END_DEAD_FRAME_MS);
        expect(service.endingNotice()?.attackerMessage).toContain('Victoire contre Defender');

        tick(COMBAT_END_LINGER_MS);
        expect(service.hasActiveCombat()).toBeFalse();
        expect(service.lastCombatOutcome()?.attackerMessage).toContain('Victoire contre Defender');
    }));

    it('tolerates attack-resolution updates when the combat panel disappears before queued animation callbacks run', fakeAsync(() => {
        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));

        spyOn(service.panelState, 'update').and.callFake((updater: (state: CombatPanelState | null) => CombatPanelState | null) => {
            service.panelState.set(updater(null));
        });

        expect(() => emitSocketEvent(CombatSocketEvents.AttackSnapshot, createAttackStatistics())).not.toThrow();
        tick(COMBAT_ROUND_RESOLUTION_DURATION_MS);

        expect(service.panelState()).toBeNull();
    }));

    it('resets combat state when the local participant disappears from the match and stores a forfeit notice when the opponent disappears', () => {
        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));

        matchStateService.match.set({
            ...createMatch(),
            players: [createPlayers()[1]],
        });
        (service as unknown as { handleParticipantDeparture: () => void }).handleParticipantDeparture();
        expect(service.panelState()).toBeNull();

        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        matchStateService.match.set({
            ...createMatch(),
            players: [createPlayers()[0]],
        });
        (service as unknown as { handleParticipantDeparture: () => void }).handleParticipantDeparture();

        expect(service.lastCombatOutcome()?.attackerMessage).toContain('par abandon');
        expect(service.panelState()).toBeNull();
    });

    it('resets combat state when participant departure is checked after the match snapshot disappears', () => {
        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        matchStateService.match.set(null);

        (service as unknown as { handleParticipantDeparture: () => void }).handleParticipantDeparture();

        expect(service.panelState()).toBeNull();
        expect(service.hasActiveCombat()).toBeFalse();
    });

    it('ignores participant departure handling when there is no active panel or no local player and leaves combat untouched when nobody left', () => {
        matchStateService.match.set(createMatch());
        (service as unknown as { handleParticipantDeparture: () => void }).handleParticipantDeparture();
        expect(service.panelState()).toBeNull();

        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        matchStateService.localPlayer.set(null);
        (service as unknown as { handleParticipantDeparture: () => void }).handleParticipantDeparture();
        expect(service.panelState()).not.toBeNull();

        matchStateService.localPlayer.set(createLocalPlayer());
        (service as unknown as { handleParticipantDeparture: () => void }).handleParticipantDeparture();
        expect(service.lastCombatOutcome()).toBeNull();
        expect(service.panelState()).not.toBeNull();
    });

    it('does not overwrite an existing ending notice when a queued outcome grace timer resolves later', fakeAsync(() => {
        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));
        emitSocketEvent(CombatSocketEvents.Victory, createCombatVictoryPayload());

        service.endingNotice.set({
            id: 'existing',
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerMessage: 'Existing',
            defenderMessage: 'Existing',
            logMessage: 'Existing',
        });

        tick(COMBAT_OUTCOME_RESOLUTION_GRACE_MS);

        expect(service.endingNotice()?.id).toBe('existing');
    }));

    it('runs the participant-departure effect when reactive dependencies change', () => {
        matchStateService.match.set(createMatch());
        emitSocketEvent(CombatSocketEvents.TurnSnapshot, createCombatTurnState('attacker', 0));

        matchStateService.match.set({
            ...createMatch(),
            players: [createPlayers()[0]],
        });

        TestBed.tick();

        expect(service.lastCombatOutcome()?.attackerMessage).toContain('par abandon');
        expect(service.panelState()).toBeNull();
    });

    it('clears spectator waiting state on session tie events and tolerates finalize calls without an active panel', () => {
        matchStateService.match.set(createSpectatorMatch());
        matchStateService.localPlayer.set(createSpectatorLocalPlayer());
        emitSocketEvent(SessionSocketEvents.CombatWaitingSnapshot, createCombatWaitingSnapshot({ round: 2, countdownSeconds: 4 }));

        emitSocketEvent(SessionSocketEvents.CombatTie, createCombatTiePayload());
        expect(service.waitingState()).toBeNull();

        service.closeCombat();
        expect(() => (service as unknown as { finalizeRoundResolution: () => void }).finalizeRoundResolution()).not.toThrow();
        expect(service.panelState()).toBeNull();
        expect(service.roundLogs()).toEqual([]);
    });

    function emitSocketEvent<T>(event: string, payload: T): void {
        const listener = listeners.get(event);
        expect(listener).withContext(`Missing listener for ${event}`).toBeDefined();
        listener?.(payload);
    }
});
