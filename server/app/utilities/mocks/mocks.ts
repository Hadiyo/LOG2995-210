import { CombatTurnService } from '@app/services/combat/combat-turn.service';
import { EndStatsService } from '@app/services/end-stats.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeMatchPlayer, makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import { CombatSession, Fighter } from '@app/utilities/combat/combat.interface';
import {
  CombatPlayerStatistics,
  CombatResultSnapshot,
  CombatTurnSnapshot,
  CombatWaitingSnapshot,
  FighterPayload,
} from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { TurnPhase } from '@common/game/turn.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Socket } from 'socket.io';

export function createMockSocket(id: string) {
    const rooms = new Set<string>();
    return {
      id,
      rooms,
      join: jest.fn((room: string) => rooms.add(room)),
      leave: jest.fn((room: string) => rooms.delete(room)),
      emit: jest.fn(),
    } as unknown as Socket;
}

export function createMockServer(overrides?: {
  sockets?: Map<string, Socket> | { sockets?: Map<string, Socket> };
}) {
  const emit = jest.fn();

  return {
    to: jest.fn(() => ({ emit })),
    emit,
      in: jest.fn().mockReturnValue({
        socketsLeave: jest.fn(),
    }),
    sockets: overrides?.sockets ?? undefined,
    ...overrides,
  };
}

export function createMockLogger() {
  return {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

export function createMockFighterPayload(
  overrides: Partial<FighterPayload> = {},
): FighterPayload {
  return {
    id: 'fighter-1',
    health: 100,
    ...overrides,
  };
}

export function createMockCombatPlayerStatistics(
  overrides: Partial<CombatPlayerStatistics> = {},
): CombatPlayerStatistics {
  return {
    attacker: createMockFighterPayload({id: 'fighter-1' }),
    victim: createMockFighterPayload({id: 'fighter-2' }),
    attackRoll: 10,
    defenseRoll: 5,
    attack: 20,
    defense: 15,
    attackBaseValue: 4,
    attackPostureBonus: 2,
    attackSanctuaryBonus: 0,
    attackPenalty: 0,
    defenseBaseValue: 4,
    defensePostureBonus: 0,
    defenseSanctuaryBonus: 0,
    defensePenalty: 0,
    damageDealt: 5,
    ...overrides,
  };
}

export function createCombatResult(
  overrides: Partial<CombatResultSnapshot> = {},
): CombatResultSnapshot {
  return {
    combatId: '6784',
    gameSessionId: '0000',
    winner: '7777',
    loser: '3333',
    ...overrides,
  };
}

export function createCombatWaitingSnapshot(
  overrides: Partial<CombatWaitingSnapshot> = {},
): CombatWaitingSnapshot {
  return {
    combatId: 'combat-1',
    gameSessionId: 'game-1',
    attackerId: 'attacker-1',
    defenderId: 'defender-1',
    activePlayerId: 'attacker-1',
    phase: 'active' as TurnPhase,
    round: 1,
    countdownSeconds: 5,
    ...overrides,
  };
}

export function createCombatTurnSnapshot(
  overrides: Partial<CombatTurnSnapshot> = {},
): CombatTurnSnapshot {
  return {
    combatId: 'combat-1',
    gameSessionId: 'game-1',
    attackerId: 'attacker-1',
    defenderId: 'defender-1',
    round: 1,
    turnState: makeTurnState(),
    ...overrides,
  };
}

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
  attackBaseValue: 4,
  attackPostureBonus: 2,
  attackSanctuaryBonus: 0,
  attackPenalty: 0,
  defenseBaseValue: 4,
  defensePostureBonus: 0,
  defenseSanctuaryBonus: 0,
  defensePenalty: 0,
  damageDealt: 4,
  ...overrides,
});

export const createGameSessionMock = (): jest.Mocked<Partial<GameSessionService>> => ({
    on: jest.fn(),
    off: jest.fn(),
    getSessionById: jest.fn(),
    endCombat: jest.fn(),
    appendCombatRoundLogs: jest.fn(),
    getMatchFromSessionId: jest.fn(),
    resolveCombatTie: jest.fn(),
    resumeSessionTurns: jest.fn(),
    getSocketFromPlayer: jest.fn(),
    getPlayerIdForSocket: jest.fn(),
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

export const createEndStatsServiceMock = (): jest.Mocked<Partial<EndStatsService>> => ({
    startCombat: jest.fn(),
    dealDamage: jest.fn(),
    takeDamage: jest.fn(),
});

