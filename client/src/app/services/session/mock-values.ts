import { GameSessionPreview, PlayerPayload, WaitingRoom } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { PlayerInformation } from '@common/player/player.interface';

/** Individual mock player */
export function createMockPlayer(): PlayerInformation {
  return {
    name: 'John',
    avatarId: 3,
    isOrganizer: false,
    dices: {
      attack: 'D4',
      defense: 'D6',
    },
    bonus: 'speed',
  };
}

/** Mock session players array */
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

/** Mock WaitingRoom */
export function createMockSessionPayload(): WaitingRoom {
  return {
    players: createMockSessionPlayers(),
    clientPlayer: createMockPlayer(),
    sessionId: 'session123',
    mapPreviewId: 'map456',
    messages: [],
    isLocked: false,
    maxPlayers: 4,
  };
}

/** Mock GameSessionPreview */
export function createMockGameSessionPreview(): GameSessionPreview {
  return {
    id: 'i1234',
    name: 'HelloWorld',
    description: 'I love this world',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 3,
    maxPlayers: 4,
    isLocked: false,
  };
}

/** Another GameSessionPreview */
export function createMockGameSessionPreview2(): GameSessionPreview {
  return {
    id: 'id8965',
    name: 'HelloWorld',
    description: 'I love this world',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 1,
    maxPlayers: 2,
    isLocked: false,
  };
}

/** Mock PlayerPayload */
export function createPlayerPayload(): PlayerPayload {
  return {
    waitingRoom: createMockSessionPayload(),
    mapPreview: createMockGameSessionPreview(),
  };
}
