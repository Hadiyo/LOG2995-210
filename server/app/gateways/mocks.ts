import { makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import {
  CombatPlayerStatistics,
  CombatResultSnapshot,
  CombatTurnSnapshot,
  CombatWaitingSnapshot,
  FighterPayload,
} from '@common/combat/combat.interface';
import { TurnPhase } from '@common/game/turn.interface';
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

