import { EndStatsService } from '@app/services/end-stats.service';
import * as combatUtils from '@app/services/game-session/game-session.runtime';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import {
    makeEndState,
    makeMatch,
    makeMatchPlayer,
    makeRuntime,
    makeTurnState,
} from '@app/services/game-session/game-session.service.spec-helpers';
import * as timerUtils from '@app/services/timer/turn.timers';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import {
    createCombatTurnServiceMock,
    createEndStatsServiceMock,
    createEventEmitterMock,
    createGameSessionMock,
    makeCombatSession,
    makeFighter,
} from '@app/utilities/mocks/mocks';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { CombatTurnService } from './combat-turn.service';
import { CombatService } from './combat.service';

/**
 * Test Strategy:
 * 
 * These tests validate the full combat lifecycle managed by CombatService,
 * including session creation, turn handling, combat flow, and cleanup.
 * The goal is to ensure that the combat logic and turns behaves correctly across both
 * normal gameplay scenarios and failure conditions.
 * 
 * Edge Cases Covered:
 * - Invalid combat initialization (createCombatSession):
 *   Tests scenarios where combat should not start, such as:
 *   - Game session not found
 *   - Game already ended
 *   - Turn phase not active
 *   - Requesting player is not the active player
 *   - Missing or invalid player data
 *   - Players not in valid positions to start combat
 *   These cases ensure that combat is only created under valid game conditions.
 * 
 * - Combat session cleanup (endCombat):
 *   Verifies that timers are cleared and sessions are removed safely,
 *   and ensures no action is taken when the session does not exist.
 * 
 * - Turn execution logic (startCombat, combatTurn):
 *   Ensures that startCombat initiates the timer
 *   Tests both branches of combatTurn:
 *   - When both players have selected stances → full combat logic executes
 *   - When at least one stance is missing → turn is skipped/switched
 *   This ensures correct flow control depending on player input completeness.
 * 
 * - Turn switching constraints (switchCombatTurn):
 *   Validates that turns only advance when:
 *   - The session exists
 *   - The phase is active
 *   - The correct player initiates the switch
 *   Prevents invalid or out-of-order turn transitions.
 * 
 * - Player disconnection handling (handleDisconnect):
 *   Covers cases where:
 *   - Player is not in combat → no action taken
 *   - Opponent is missing → combat ends without winner
 *   - Opponent is present → winner is set and result is emitted
 *   This ensures resilience to real-world issues like unexpected disconnects.
 * 
 * - Timeout handling (handleTurnTimeout):
 *   Ensures that a timeout results in a default (null) stance submission,
 *   preventing the combat from stalling indefinitely.
 * 
 * Rationale:
 * These edge cases were selected because they represent critical points
 * where the system could fail during the combat and in between combats. 
 * Testing them ensures the combat lifecycle remains consistent, predictable, and fault-tolerant.
 */

describe('Combat Life Cycle', () => {
    let service: CombatService;
    let gameSessionMock: Partial<GameSessionService>;
    let turnServiceMock: Partial<CombatTurnService>;
    let eventEmitterMock: Partial<EventEmitter2>;
    let endStatsService: Partial<EndStatsService>;

    beforeEach(async () => {

        gameSessionMock = createGameSessionMock();
        turnServiceMock = createCombatTurnServiceMock();
        eventEmitterMock = createEventEmitterMock();
        endStatsService = createEndStatsServiceMock();

        const module: TestingModule = await Test.createTestingModule({
            providers: [CombatService,
            { provide: GameSessionService, useValue: gameSessionMock },
            { provide: CombatTurnService, useValue: turnServiceMock },
            { provide: EventEmitter2, useValue: eventEmitterMock },
            { provide: EndStatsService, useValue: endStatsService },
            ],
        }).compile();

        service = module.get<CombatService>(CombatService);

        jest.clearAllMocks();
        // To ensure that previous tests modifying this resource does not interfer with other tests
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)['combatSessions'].clear();
    });

    it('should return null if game does not exist - createCombatSession', () => {
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(undefined);
        const result = service.createCombatSession('player1', 'player2', 'idk');
        expect(result).toBe(null);
    });
    
    it('should return null if the game has ended - createCombatSession', () => {
        const game = makeRuntime( {match: makeMatch({endState: makeEndState()})});
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(game);
        const result = service.createCombatSession('player1', 'player2', 'idk');
        expect(result).toBe(null);
    });
    
    it('should return null if the current game turn state is not active - createCombatSession', () => {
        const game = makeRuntime( {turnState: makeTurnState({phase: 'transition'})});
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(game);
        const result = service.createCombatSession('player1', 'player2', 'idk');
        expect(result).toBe(null);
    });
    
    it('should return null if the activePlayer is not the player who requested the fight - createCombatSession', () => {
        const game = makeRuntime( {turnState: makeTurnState({activePlayerId: 'player1'})});
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(game);
        const result = service.createCombatSession('player3', 'player2', 'idk');
        expect(result).toBe(null);
    });
    
    it('should return null if at least one of the players is not found in the game session - createCombatSession', () => {
        const game = makeRuntime( {turnState: makeTurnState({activePlayerId: 'player1'})});
        const player1 = makeFighter({stats: undefined});
        const player2 = makeFighter();
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(game);
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'createFighter').mockReturnValueOnce(player1).mockReturnValueOnce(player2);
        const result = service.createCombatSession('player1', 'player2', 'idk');
        expect(result).toBe(null);
    });
    
    it('should return null if the players are not next to each other - createCombatSession', () => {
        const game = makeRuntime({match: makeMatch({endState: undefined}), turnState: makeTurnState({phase: 'active', activePlayerId: 'player1'})});
        const player1 = makeFighter();
        const player2 = makeFighter();
        jest.spyOn(combatUtils, 'canStartCombat').mockReturnValue(false);
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(game);
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'createFighter').mockReturnValueOnce(player1).mockReturnValueOnce(player2);
        const result = service.createCombatSession('player1', 'player2', 'idk');
        expect(result).toBe(null);
    });
    
    it('should create a valid combat session - createCombatSession', () => {
        const player1 = makeFighter({stats: makeMatchPlayer({ id: 'player1', position: {x: 1, y: 1}})});
        const player2 = makeFighter({stats: makeMatchPlayer({ id: 'player2', position: {x: 1, y: 2}})});
        const game = makeRuntime( {match: makeMatch({ players: [player1.stats, player2.stats], endState: undefined}),
          turnState: makeTurnState({ phase: 'active', activePlayerId: 'player1'})});
        const turnState = makeTurnState();
    
        (gameSessionMock.getSessionById as jest.Mock).mockReturnValue(game);
        jest.spyOn(crypto, 'randomUUID').mockReturnValue('1111-2222-3333-4444-5555');
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'createFighter').mockReturnValueOnce(player1).mockReturnValueOnce(player2);
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(turnServiceMock as any, 'initCombatTurnState').mockReturnValue(turnState);
        jest.spyOn(combatUtils, 'canStartCombat').mockReturnValue(true);
    
        const result = service.createCombatSession('player1', 'player2', '1234');
    
        const session = service['combatSessions'].get('1111-2222-3333-4444-5555');
    
        expect(session).toBeDefined();
        expect(result).toEqual({ combat: {
          id: '1111-2222-3333-4444-5555',
          gameSessionId: '1234',
          round: 1,
          players: [player1, player2],
          turnState,
          transitionTimeoutId: null,
          activeTurnTimeoutId: null,
          timerIntervalId: null,
        }, game});
    });
    
    it('should call startTransition - startCombat', () => {
        const spy = jest.spyOn(turnServiceMock, 'startTransition');
        const session = makeCombatSession();
        service.startCombat(session);
        expect(spy).toHaveBeenCalledWith(session);
    });
    
    it('should clear timers and delete combat session if session exists - endCombat', () => {
        const session = makeCombatSession();
        service['combatSessions'].set(session.id, session);
    
        const spy = jest.spyOn(timerUtils, 'clearTurnState');
        
        service.endCombat(session.id);
        
        expect(spy).toHaveBeenCalledWith(session);
    
        const oldSession = service['combatSessions'].get('id1234');
        expect(oldSession).not.toBeDefined();
    });
    
    it('should do nothing if the session does not exist - endCombat', () => {
        const timerSpy = jest.spyOn(timerUtils, 'clearTurnState').mockImplementation();
        service.endCombat('5678');
        expect(timerSpy).not.toHaveBeenCalled();;
    });

    it('should return false if the session is undefined - combatTurn', () => {
        const session = makeCombatSession();
        const result = service.combatTurn(session.id, 'player1', 'attack');
        expect(result).toBe(false);
    });
    
    it('should return false if the players stance was not set correctly - combatTurn', () => {
        const session = makeCombatSession();
        service['combatSessions'].set(session.id, session);
    
        // To spy and mock a private method
        const stanceSpy = jest
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .spyOn(service as any, 'setCombatStance')
            .mockReturnValue(false);
    
        const result = service.combatTurn(session.id, 'player1', 'attack');
    
        expect(stanceSpy).toHaveBeenCalled();
        expect(result).toBe(false);
    });
    
    it('should call all combat logic if both player stances are both defined - combatTurn', () => {
        const session = makeCombatSession();
        session.players[0].combatStance = 'attack';
        session.players[0].hasSelectedStance = true;
        session.players[1].combatStance = 'defense';
        session.players[1].hasSelectedStance = true;
        service['combatSessions'].set(session.id, session);
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'setCombatStance').mockReturnValue(true);
        // To spy and mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onIceSpy = jest.spyOn(service as any, 'isFighterOnIce').mockReturnValue(false);
        // To spy and mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attackSpy = jest.spyOn(service as any, 'attack').mockReturnValue({});
        const evaluateSpy = jest.spyOn(service, 'evaluateCombatResult').mockReturnValue(true);
        const switchTurnSpy = jest.spyOn(service, 'switchCombatTurn').mockReturnValue(true);
    
        const result = service.combatTurn(session.id, 'player1', 'attack');
    
        expect(onIceSpy).toHaveBeenCalledTimes(2);
        expect(attackSpy).toHaveBeenCalledTimes(2);
        expect(switchTurnSpy).not.toHaveBeenCalled();
        expect(evaluateSpy).toHaveBeenCalled();
        expect(result).toBe(true);
    });
    
    it('should switch combat turn if one of the player stance is undefined - combatTurn', () => {
        const session = makeCombatSession();
        session.players[0].combatStance = 'attack';
        session.players[0].hasSelectedStance = true;
        session.players[1].combatStance = null;
        session.players[1].hasSelectedStance = false;
        service['combatSessions'].set(session.id, session);
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'setCombatStance').mockReturnValue(true);
    
        // To spy and mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onIceSpy = jest.spyOn(service as any, 'isFighterOnIce').mockReturnValue(false);
        // To spy and mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attackSpy = jest.spyOn(service as any, 'attack').mockReturnValue({});
        const evaluateSpy = jest.spyOn(service, 'evaluateCombatResult').mockReturnValue(true);
        const switchTurnSpy = jest.spyOn(service, 'switchCombatTurn').mockReturnValue(true);
    
        const result = service.combatTurn(session.id, 'player1', 'attack');
    
        expect(onIceSpy).not.toHaveBeenCalled();
        expect(attackSpy).not.toHaveBeenCalled();
        expect(evaluateSpy).not.toHaveBeenCalled();
        expect(switchTurnSpy).toHaveBeenCalled();
        expect(result).toBe(true);
    });

        it('should return false if the session is undefined - switchCombatTurn', () => {
        const result = service.switchCombatTurn(undefined, 'player1');
        expect(result).toBe(false);
    });

    it('should return false if the session phase is not active - switchCombatTurn', () => {
        const session = makeCombatSession({turnState: makeTurnState({phase: 'transition', activePlayerId: 'player1'})});
        const result = service.switchCombatTurn(session, 'player1');
        expect(result).toBe(false);
    });

    it('should return false if the activePlayer is not the player whos turn must change - switchCombatTurn', () => {
        const session = makeCombatSession({turnState: makeTurnState({phase: 'transition', activePlayerId: 'player2'})});
        const result = service.switchCombatTurn(session, 'player1');
        expect(result).toBe(false);
    });

    it('should advance to next turn and return true - switchCombatTurn - switchCombatTurn', () => {
        const session = makeCombatSession({turnState: makeTurnState({phase: 'active', activePlayerId: 'player1'})});
        const spy = jest.spyOn(turnServiceMock, 'advanceToNextTurn');

        const result = service.switchCombatTurn(session, 'player1');

        expect(spy).toHaveBeenCalledWith(session);
        expect(result).toBe(true);
    });

    it('should return void if the player who disconnected is not part of any combat sessions', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'getCombatFromPlayer').mockReturnValue(undefined);
        const spy = jest.spyOn(service, 'endCombat').mockImplementation();
        const spy2 = jest.spyOn(gameSessionMock, 'endCombat').mockImplementation();

        service['handleDisconnect']('player1');

        expect(spy).not.toHaveBeenCalled();
        expect(spy2).not.toHaveBeenCalled();
    });
    
    it('should end the combat even if the opponent is no longer part of the combatSession', () => {
        const player = makeFighter();
        const combat = makeCombatSession({players: [player]});
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'getCombatFromPlayer').mockReturnValue(combat);
        const spy = jest.spyOn(service, 'endCombat').mockImplementation();

        service['handleDisconnect'](player.stats.id);

        expect(spy).toHaveBeenCalledWith(combat.id);
    });

    it('should set the winner and emit the combat results if the opponent is still in the combat session', () => {
        const player1 = makeFighter({}, {id:'player1'});
        const player2 = makeFighter({}, {id: 'player2'});
        const combat = makeCombatSession({players: [player1, player2]});
        const gameSession = makeRuntime({ match: makeMatch({players: [player2.stats]})});
        jest.spyOn(gameSessionMock, 'getSessionById').mockReturnValue(gameSession);
        // To mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jest.spyOn(service as any, 'getCombatFromPlayer').mockReturnValue(combat);
        const spy = jest.spyOn(service, 'endCombat').mockImplementation();
        // To spy and mock a private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spy3 = jest.spyOn(service as any, 'emitCombatResultSnapshot').mockImplementation();

        service['handleDisconnect'](player1.stats.id);

        expect(spy3).toHaveBeenCalledWith(CombatEvents.ClientDisconnect, combat, player2.stats.id, player1.stats.id);
        expect(spy).toHaveBeenCalledWith(combat.id);
    });

    it('should submit a null stance when the active combat turn times out', () => {
        const session = makeCombatSession({ id: 'combat-1'});
        service['combatSessions'].set(session.id, session);
        const combatTurnSpy = jest.spyOn(service, 'combatTurn').mockReturnValue(false);

        service['handleTurnTimeout']({ combatId: 'combat-1', playerId: 'player-1' });

        expect(combatTurnSpy).toHaveBeenCalledWith('combat-1', 'player-1', null);
    });

    it('should return undefined if the session does not exist - handleTurnTimeout', () => {
        const combatTurnSpy = jest.spyOn(service, 'combatTurn').mockImplementation();

        service['handleTurnTimeout']({ combatId: 'combat-1', playerId: 'player-1' });

        expect(combatTurnSpy).not.toHaveBeenCalled();
    });
});
