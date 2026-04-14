import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeMatchPlayer, makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import { CombatSession, Fighter } from '@app/utilities/combat/combat.interface';
import { CombatPlayerStatistics, FighterPayload } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CombatTurnService } from './combat-turn.service';

export const makeCombatSession = (overrides: Partial<CombatSession> = {}): CombatSession => ({
    id: 'id1234',
    gameSessionId: 'game1234',
    round: 1,
    players: [makeFighter({}, { id: 'player1'}), makeFighter({}, { id: 'player2'})],
    turnState: makeTurnState(),
    transitionTimeoutId: null,
    activeTurnTimeoutId: null,
    timerIntervalId: null,
    ...overrides,
});

export const makeFighter = (
  overrides: Partial<Fighter> = {},
  statsOverrides: Partial<MatchPlayer> = {},
): Fighter => ({
  stats: makeMatchPlayer(statsOverrides),
  combatStance: null,
  hasSelectedStance: false,
  hasPenalty: false,
  ...overrides,
});

export const makeFighterPayload = (overrides: Partial<FighterPayload> = {}): FighterPayload => ({
  id: '1234',
  health: 4,
  ...overrides,
});

export const makeCombatPlayerStatistics = (overrides: Partial<CombatPlayerStatistics> = {}): CombatPlayerStatistics => ({
  attacker: makeFighterPayload(),
  victim: makeFighterPayload(),
  attackRoll: 4,
  defenseRoll: 3,
  attack: 6,
  defense: 2,
  ...overrides,
});

export const createGameSessionMock = (): jest.Mocked<Partial<GameSessionService>> => ({
    on: jest.fn(),
    off: jest.fn(),
    getSessionById: jest.fn(),
    endCombat: jest.fn(),
    getMatchFromSessionId: jest.fn(),
    setWinner: jest.fn(),
    stopSessionTimers: jest.fn(),
});

export const createCombatTurnServiceMock = (): jest.Mocked<Partial<CombatTurnService>> => ({
    startTransition: jest.fn(),
    advanceToNextTurn: jest.fn(),
    initCombatTurnState: jest.fn(),
});

export const createEventEmitterMock = (): jest.Mocked<Partial<EventEmitter2>> => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
});
