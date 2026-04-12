import { CombatPlayerStatistics, CombatResultSnapshot, FighterPayload } from '@common/combat/combat.interface';
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

export function createMockServer() {
  const emit = jest.fn();
  const socketsMap = new Map([['socket-123', createMockSocket('socket-123')]]);
  return {
    to: jest.fn(() => ({ emit })),
    emit,
    sockets: socketsMap,
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
