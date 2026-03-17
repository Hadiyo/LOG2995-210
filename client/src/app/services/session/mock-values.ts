import { GameSessionPreview, PlayerPayload, WaitingRoom } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { PlayerInformation } from '@common/player/player.interface';


export const mockSessionPlayers: PlayerInformation[] = [
  {
    name: 'Alice',
    avatarId: 1,
    isOrganizer: true,
    dices: {
        attack: 'D4',
        defense: 'D6',
    },
    bonus: 'speed',
  },
  {
    name: 'Bob',
    avatarId: 2,
    isOrganizer: false,
    dices: {
        attack: 'D6',
        defense: 'D4',
    },
    bonus: 'life',
  },
];

export const mockPlayer: PlayerInformation = {
    name: 'John',
    avatarId: 3,
    isOrganizer: false,
    dices: {
        attack: 'D4',
        defense: 'D6',
    },
    bonus: 'speed',
};

export const mockSessionPayload: WaitingRoom = {
  players: mockSessionPlayers,
  clientPlayer: mockPlayer,
  sessionId: 'session123',
  mapPreviewId: 'map456',
  messages: [],
  isLocked: false,
  maxPlayers: 4,
};

export const mockGameSessionPreview: GameSessionPreview = {
    id: 'i1234',
    name: 'HelloWorld',
    description: 'I love this world',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 2,
    maxPlayers: 2,
    isLocked: false,
};


export const playerPayload: PlayerPayload = {
    waitingRoom: mockSessionPayload,
    mapPreview: mockGameSessionPreview,
};