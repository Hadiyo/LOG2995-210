import { InternalPlayer } from '@app/interface/player.interface';
import { ChatMessage } from '@common/chat/chat.interface';
import { GameSession, GameSessionPreview, WaitingRoom } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { Player, PlayerInformation, PlayerStatus } from '@common/player/player.interface';

export function createMockSessionPlayers(): PlayerInformation[] {
  return [
    {
      name: 'Alice',
      avatarId: 1,
      isOrganizer: true,
      dices: { attack: 'D4', defense: 'D6' },
      bonus: 'speed',
    },
    {
      name: 'Bob',
      avatarId: 2,
      isOrganizer: false,
      dices: { attack: 'D6', defense: 'D4' },
      bonus: 'life',
    },
  ];
}

export const createMockPlayer = (overrides: Partial<Player> = {}): Player => {

  const base: Player = {
    id: 'player-1',

    information: {
      name: 'TestPlayer',
      avatarId: 0,
      isOrganizer: false,
      dices: {
        attack: 'D4',
        defense: 'D6',
      },
      bonus: 'speed',
    },

    state: {
      position: { x: 0, y: 0 },
      status: PlayerStatus.Active,
      attributes: {
        health: 100,
        maxHealth: 100,
        speed: 5,
        attack: 10,
        defense: 5,
      },
      wins: 0,
      remainingActions: 1,
      remainingMovements: 3,
    },

    render: {
      facing: 'front',
      pose: 'idle',
      poseStartedAt: new Date().toISOString(),
      poseDurationMs: 1000,
    },
  };

  return {
    ...base,
    ...overrides,
    information: {
      ...base.information,
      ...overrides.information,
    },
    state: {
      ...base.state,
      ...overrides.state,
    },
    render: {
      ...base.render,
      ...overrides.render,
    },
  };
};

export function createInternalPlayer(
    socketIdOverrides: Partial<string> = '', 
    playerOverrides: Partial<Player> = {},
): InternalPlayer {
  return {
    socketId: socketIdOverrides,
    player: createMockPlayer(playerOverrides),
  };
}

// -------------------- Chat Messages --------------------
export function mockChatMessage1(): ChatMessage {
    return {
        id: 'ncjdkscbnjk',
        author: 'Bob',
        content: 'I love potatoes',
        createdAt: 'never',
    };
}

export function mockChatMessages(): ChatMessage[] {
    return [mockChatMessage1()];
}

// -------------------- Game Sessions --------------------
export function mockGameSession1(): GameSession {
    return {
        id: 'session1',
        players: ['player1Id', 'player2Id'],
        mapTemplateId: 'map1',
        debugMode: false,
        isLocked: false,
        maxPlayers: 4,
        messages: mockChatMessages(),
        hasStarted: false,
    };
}

export function mockGameSession2(): GameSession {
    return {
        id: 'session2',
        players: ['playerId1'],
        mapTemplateId: 'map2',
        debugMode: true,
        isLocked: true,
        maxPlayers: 6,
        messages: [],
        hasStarted: true,
    };
}

// -------------------- Game Session Preview --------------------
export function mockGameSessionPreview1(): GameSessionPreview {
    return {
        id: 'map1',
        name: 'Forest',
        description: 'A dense forest map',
        mode: GameMode.CLASSIC,
        size: MapSize.M,
        nbOfPlayers: 2,
        maxPlayers: 4,
        isLocked: false,
        previewImage: 'forest.png',
        previewImageFormat: 'png',
    };
}

// -------------------- Waiting Rooms --------------------
export function mockWaitingRoom1(): WaitingRoom {
    return {
        sessionId: 'session1',
        mapPreviewId: 'map1',
        players: createMockSessionPlayers(),
        messages: mockChatMessages(),
        isLocked: false,
        maxPlayers: 4,
    };
}

export function mockWaitingRoom2(): WaitingRoom {
    return {
        sessionId: 'session2',
        mapPreviewId: 'map2',
        players: createMockSessionPlayers(),
        messages: [],
        isLocked: true,
        maxPlayers: 6,
    };
}