import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeMatch } from '@app/services/game-session/game-session.service.spec-helpers';
import { BONUS, MIN_DIE_VALUE } from '@app/utilities/combat/combat.constants';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import {
  createCombatTurnServiceMock,
  createEventEmitterMock,
  createGameSessionMock,
  makeCombatPlayerStatistics,
  makeCombatSession,
  makeFighter,
  makeFighterPayload,
} from '@app/utilities/mocks/mocks';
import { DIE_D4_SIDES, DIE_D6_SIDES } from '@common/character/character.model';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { CombatTurnService } from './combat-turn.service';
import { CombatService } from './combat.service';

/**
 * Test Strategy:
 * 
 * These tests validate the core combat logic of CombatService, focusing on
 * attack resolution and combat result evaluation. The goal is to ensure that
 * combat outcomes are correct, consistent, and robust under both normal and
 * edge-case conditions.
 * 
 * Edge Cases Covered:
 * - Invalid inputs (evaluateCombatResult):
 *   Tests scenarios where the session or attack data is undefined.
 *   Ensures the method safely returns false instead of causing runtime errors.
 * 
 * - Combat termination conditions (evaluateCombatResult):
 *   Covers all possible outcomes:
 *   - One player reaches 0 health → correct winner is determined
 *   - Both players reach 0 health → tie is declared
 *   - No player reaches 0 health → combat continues and turn switches
 *   These cases ensure correct game flow and prevent inconsistent or invalid states.
 * 
 * - Invalid state during turn transition:
 *   Verifies that if combat stances are not properly reset, the turn does not proceed.
 *   This prevents invalid or desynchronized combat states.
 * 
 * - Debug mode behavior (attack):
 *   Tests deterministic combat outcomes when debug mode is enabled:
 *   - Instigator receives maximum roll
 *   - Opponent receives minimum roll
 *   This ensures predictable behavior for testing and debugging purposes.
 * 
 * - Random roll behavior (attack):
 *   Ensures that random dice rolls are used when debug mode is disabled,
 *   validating the normal probabilistic combat flow.
 * 
 * - Bonus application (attack):
 *   Tests that bonuses are applied only when:
 *   - The correct combat stance is selected
 *   - The player is in a valid position (on ice)
 *   Also verifies that bonuses are not applied in invalid conditions.
 * 
 * - Damage handling (attack):
 *   Ensures that:
 *   - Health is updated only when damage is positive
 *   - No update occurs when damage is zero or negative
 *   This prevents incorrect health modifications.
 * 
 * - Output structure validation (attack):
 *   Confirms that the returned combat payload contains all required fields,
 *   ensuring compatibility with other parts of the system.
 * 
 * Rationale:
 * These edge cases were selected because they represent critical combat
 * scenarios where incorrect logic could break combat flow, such as invalid inputs,
 * boundary health values (0 HP), incorrect bonus application, and deterministic
 * vs random behavior. Testing these ensures the combat system remains stable,
 * predictable, and aligned with game rules.
 */

describe('CombatService', () => {
  let service: CombatService;
  let gameSessionMock: Partial<GameSessionService>;
  let turnServiceMock: Partial<CombatTurnService>;
  let eventEmitterMock: Partial<EventEmitter2>;
  let emitSpy: jest.SpyInstance;

  beforeEach(async () => {

    gameSessionMock = createGameSessionMock();
    turnServiceMock = createCombatTurnServiceMock();
    eventEmitterMock = createEventEmitterMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CombatService,
        { provide: GameSessionService, useValue: gameSessionMock },
        { provide: CombatTurnService, useValue: turnServiceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<CombatService>(CombatService);

    emitSpy = jest.spyOn(eventEmitterMock, 'emit');

    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)['combatSessions'].clear();
  });

  it('should return false if one of the attacks is undefined - evaluateCombatResult', () => {
    const session = makeCombatSession();
    const combatStatistics = makeCombatPlayerStatistics();
    const result = service.evaluateCombatResult(session, [undefined, combatStatistics]);
    expect(result).toBe(false);
  });

  it('should return false if both attacks are undefined - evaluateCombatResult', () => {
    const session = makeCombatSession();
    const result = service.evaluateCombatResult(session, [undefined, undefined]);
    expect(result).toBe(false);
  });

  it('should return false if session in undefined - evaluateCombatResult', () => {
    const combatStatistics1 = makeCombatPlayerStatistics();
    const combatStatistics2 = makeCombatPlayerStatistics();
    const result = service.evaluateCombatResult(undefined, [combatStatistics1, combatStatistics2]);
    expect(result).toBe(false);
  });

  it('should end the combat and return true if the current player is the winner - evaluateCombatResult', () => {
    const session = makeCombatSession();
    session.players[0].stats.health = 4;
    session.players[1].stats.health = 0;
    const combatStatistics1 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player1'})});
    const combatStatistics2 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player2'})});

    const spy = jest.spyOn(gameSessionMock, 'endCombat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy2 = jest.spyOn(service as any, 'emitCombatResultSnapshot').mockImplementation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy3 = jest.spyOn(service as any, 'endCombat').mockImplementation();

    const result = service.evaluateCombatResult(session, [combatStatistics1, combatStatistics2]);
    expect(emitSpy).toHaveBeenCalledWith(CombatEvents.Statistics, {
      combatId: session.id,
      statistics: [combatStatistics1, combatStatistics2],
    });
    expect(spy).toHaveBeenCalledWith(
      session.gameSessionId, 
      session.players[0].stats.id, 
      session.players[1].stats.id);
    expect(spy2).toHaveBeenCalledWith(
      CombatEvents.Victory, 
      session, 
      session.players[0].stats.id, 
      session.players[1].stats.id);
    expect(spy3).toHaveBeenCalledWith(session.id);
    expect(result).toBe(true);
  });

  it('should end the combat and return true if the other player is the winner - evaluateCombatResult', () => {
    const session = makeCombatSession();
    session.players[0].stats.health = 0;
    session.players[1].stats.health = 4;
    const combatStatistics1 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player1'})});
    const combatStatistics2 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player2'})});

    const spy = jest.spyOn(gameSessionMock, 'endCombat');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy2 = jest.spyOn(service as any, 'emitCombatResultSnapshot').mockImplementation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy3 = jest.spyOn(service as any, 'endCombat').mockImplementation();

    const result = service.evaluateCombatResult(session, [combatStatistics1, combatStatistics2]);
    expect(emitSpy).toHaveBeenCalledWith(CombatEvents.Statistics, {
      combatId: session.id,
      statistics: [combatStatistics1, combatStatistics2],
    });
    expect(spy).toHaveBeenCalledWith(
      session.gameSessionId, 
      session.players[1].stats.id, 
      session.players[0].stats.id);
    expect(spy2).toHaveBeenCalledWith(
      CombatEvents.Victory, 
      session, 
      session.players[1].stats.id, 
      session.players[0].stats.id);
    expect(spy3).toHaveBeenCalledWith(session.id);
    expect(result).toBe(true);
  });

  it('should end the combat and return true if the combat is a tie - evaluateCombatResult', () => {
    const session = makeCombatSession();
    session.players[0].stats.health = 0;
    session.players[1].stats.health = 0;
    const combatStatistics1 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player1'})});
    const combatStatistics2 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player2'})});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy2 = jest.spyOn(service as any, 'emitCombatResultSnapshot').mockImplementation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy3 = jest.spyOn(service as any, 'endCombat').mockImplementation();
    const spy4 = jest.spyOn(gameSessionMock, 'resolveCombatTie').mockImplementation();

    const result = service.evaluateCombatResult(session, [combatStatistics1, combatStatistics2]);

    expect(emitSpy).toHaveBeenCalledWith(CombatEvents.Statistics, {
      combatId: session.id,
      statistics: [combatStatistics1, combatStatistics2],
    });
    expect(spy2).toHaveBeenCalledWith(
      CombatEvents.Tie, 
      session, 
      session.players[0].stats.id, 
      session.players[1].stats.id);
    expect(spy3).toHaveBeenCalledWith(session.id);
    expect(spy4).toHaveBeenCalledWith(session.gameSessionId, session.players[0].stats.id, session.players[1].stats.id);
    expect(result).toBe(true);
  });

  it('should return true and switch combat turn is none of the players have ZERO health - evaluateCombatResult', () => {
    const session = makeCombatSession();
    session.players[0].stats.health = 4;
    session.players[1].stats.health = 4;
    const combatStatistics1 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player1'})});
    const combatStatistics2 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player2'})});
    const attacks = [combatStatistics1, combatStatistics2];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'clearCombatStance').mockReturnValueOnce(true).mockReturnValueOnce(true);
    const spy1 = jest.spyOn(service, 'switchCombatTurn').mockReturnValue(true);

    const result = service.evaluateCombatResult(session, attacks);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy1).toHaveBeenCalledWith(session, 'player1');
    expect(emitSpy).toHaveBeenCalledWith(CombatEvents.Statistics, {
      combatId: session.id,
      statistics: attacks,
    });
    expect(result).toBe(true);
  });

  it('should return false if the stances are not correctly reset upon turn switch - evaluateCombatResult', () => {
    const session = makeCombatSession();
    session.players[0].stats.health = 4;
    session.players[1].stats.health = 4;
    const combatStatistics1 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player1'})});
    const combatStatistics2 = makeCombatPlayerStatistics({ attacker: makeFighterPayload({id: 'player2'})});
    const attacks = [combatStatistics1, combatStatistics2];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'clearCombatStance').mockReturnValueOnce(false).mockReturnValueOnce(false);
    const spy1 = jest.spyOn(service, 'switchCombatTurn').mockReturnValue(true);

    const result = service.evaluateCombatResult(session, attacks);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy1).not.toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should give the instigator maximum attack and the defender minimum defense if debugMode is on - attack', () => {
    const session = makeCombatSession({players: [
      makeFighter({}, { id: 'player1', attackDie:'D4'}),
      makeFighter({}, { id: 'player2'}),
    ]});
    const match = makeMatch({debugMode: true});
    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'rollDie');

    const result = service['attack'](session, session.players[0], true, session.players[1], false);

    expect(result.attackRoll).toBe(DIE_D4_SIDES);
    expect(result.defenseRoll).toBe(MIN_DIE_VALUE);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should give the instigator maximum attack with D6 if debug is on - attack', () => {
    const session = makeCombatSession({players: [
      makeFighter({}, { id: 'player1', attackDie:'D6'}),
      makeFighter({}, { id: 'player2'}),
    ]});
    const match = makeMatch({debugMode: true});
    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'rollDie');

    const result = service['attack'](session, session.players[0], true, session.players[1], false);

    expect(result.attackRoll).toBe(DIE_D6_SIDES);
    expect(result.defenseRoll).toBe(MIN_DIE_VALUE);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should give the non-instigator minimum attack and the instigator maximum defense if debugMode is on - attack', () => {
    const session = makeCombatSession({players: [
      makeFighter({}, { id: 'player1', defenseDie: 'D4' }),
      makeFighter({}, { id: 'player2', attackDie:'D6' }),
    ]});
    const match = makeMatch({debugMode: true});
    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'rollDie');

    const result = service['attack'](session, session.players[1], false, session.players[0], false);

    expect(result.attackRoll).toBe(MIN_DIE_VALUE);
    expect(result.defenseRoll).toBe(DIE_D4_SIDES);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should set a random dice roll if debug mode is off - attack', () => {
    const ROLL1 = 3;
    const ROLL2 = 2;
    const session = makeCombatSession();
    const match = makeMatch({ debugMode: false });

    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'rollDie')
      .mockReturnValueOnce(ROLL1)
      .mockReturnValueOnce(ROLL2);

    const result = service['attack'](
      session,
      session.players[0],
      false,
      session.players[1],
      false,
    );

    expect(result.attackRoll).toBe(ROLL1);
    expect(result.defenseRoll).toBe(ROLL2);
  });

  it('should add the bonuses if the combatStance matches the player and the players are on ice - attack', () => {
    const ROLL1 = 2;
    const ROLL2 = 2;
    const session = makeCombatSession();
    const match = makeMatch({ debugMode: false });

    const attacker = session.players[0];
    const defender = session.players[1];

    attacker.combatStance = 'attack';
    defender.combatStance = 'defense';

    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'rollDie')
      .mockReturnValueOnce(ROLL1)
      .mockReturnValueOnce(ROLL2);

    const result = service['attack'](session, attacker, true, defender, true);

    expect(result.attack).toBe(
      attacker.stats.baseAttack + 2 + BONUS - BONUS,
    );

    expect(result.defense).toBe(
      defender.stats.baseDefense + 2 + BONUS - BONUS,
    );
  });

  it('should include sanctuary bonuses and default missing ones to zero - attack', () => {
    const bonusRoll1 = 3;
    const bonusRoll2 = 2;
    const fallbackRoll1 = 2;
    const fallbackRoll2 = 1;
    const match = makeMatch({ debugMode: false });
    const bonusSession = makeCombatSession({
      players: [makeFighter({ combatStance: 'attack' }, { id: 'player1', attackBonus: 2 }),
        makeFighter({ combatStance: 'defense' }, { id: 'player2', defenseBonus: 1 })],
    });
    const fallbackSession = makeCombatSession({
      players: [makeFighter({ combatStance: 'attack' }, { id: 'player1', attackBonus: undefined }),
        makeFighter({ combatStance: 'defense' }, { id: 'player2', defenseBonus: undefined })],
    });

    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'rollDie')
      .mockReturnValueOnce(bonusRoll1).mockReturnValueOnce(bonusRoll2)
      .mockReturnValueOnce(fallbackRoll1).mockReturnValueOnce(fallbackRoll2);

    const bonusResult = service['attack'](bonusSession, bonusSession.players[0], false, bonusSession.players[1], false);
    const fallbackResult = service['attack'](fallbackSession, fallbackSession.players[0], false, fallbackSession.players[1], false);

    expect(bonusResult.attack).toBe(bonusSession.players[0].stats.baseAttack + 2 + bonusRoll1 + BONUS);
    expect(bonusResult.defense).toBe(bonusSession.players[1].stats.baseDefense + 1 + bonusRoll2 + BONUS);
    expect(fallbackResult.attack).toBe(fallbackSession.players[0].stats.baseAttack + fallbackRoll1 + BONUS);
    expect(fallbackResult.defense).toBe(fallbackSession.players[1].stats.baseDefense + fallbackRoll2 + BONUS);
  });

  it('should not set the bonus if the players did not pick the correct stance and are not on ice - attack', () => {
  const ROLL1 = 1;
  const ROLL2 = 1;
  const session = makeCombatSession();
  const match = makeMatch({ debugMode: false });

  const attacker = session.players[0];
  const defender = session.players[1];

  attacker.combatStance = 'defense';
  defender.combatStance = 'attack';

  jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jest.spyOn(service as any, 'rollDie')
    .mockReturnValueOnce(ROLL1)
    .mockReturnValueOnce(ROLL2);

  const result = service['attack'](session, attacker, false, defender, false);

  expect(result.attack).toBe(attacker.stats.baseAttack + ROLL1);
  expect(result.defense).toBe(defender.stats.baseDefense + ROLL2);
  });

  it('should update the players health if damage is above 0 - attack', () => {
    const ROLL1 = 10;
    const ROLL2 = 1;
    const HEALTH = 50;
    const session = makeCombatSession();
    const match = makeMatch({ debugMode: false });

    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'rollDie')
      .mockReturnValueOnce(ROLL1)
      .mockReturnValueOnce(ROLL2);

    const updatedPlayer = { stats: { id: 'def', health: HEALTH } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'updatePlayerHealth')
      .mockReturnValue(updatedPlayer);

    const result = service['attack'](
      session,
      session.players[0],
      false,
      session.players[1],
      false,
    );

    expect(spy).toHaveBeenCalled();
    expect(result.victim.health).toBe(HEALTH);
  });

  it('should not update the players health if the damage is below 0 - attack', () => {
    const ROLL1 = 10;
    const ROLL2 = 1;
    const session = makeCombatSession();
    const match = makeMatch({ debugMode: false });

    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(service as any, 'rollDie')
      .mockReturnValueOnce(ROLL2)
      .mockReturnValueOnce(ROLL1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy = jest.spyOn(service as any, 'updatePlayerHealth');

    const result = service['attack'](
      session,
      session.players[0],
      false,
      session.players[1],
      false,
    );

    expect(spy).not.toHaveBeenCalled();
    expect(result.victim.health).toBe(session.players[1].stats.health);
  });

  it('should return the correct payload - attack', () => {
    const session = makeCombatSession();
    const match = makeMatch({ debugMode: true });

    jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);

    const result = service['attack'](
      session,
      session.players[0],
      false,
      session.players[1],
      false,
    );

    expect(result).toHaveProperty('attacker');
    expect(result).toHaveProperty('victim');
    expect(result).toHaveProperty('attackRoll');
    expect(result).toHaveProperty('defenseRoll');
    expect(result).toHaveProperty('attack');
    expect(result).toHaveProperty('defense');
  });
});
