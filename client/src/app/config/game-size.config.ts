import { MapSize } from '@common/enum';

export type GameSizeOption = {
  value: MapSize;
  label: string;
  minPlayers: number;
  maxPlayers: number;
};

export const GAME_SIZE_CONFIG: readonly GameSizeOption[] = [
  {
    value: MapSize.S,
    label: 'Petite',
    minPlayers: 2,
    maxPlayers: 2,
  },
  {
    value: MapSize.M,
    label: 'Moyenne',
    minPlayers: 2,
    maxPlayers: 4,
  },
  {
    value: MapSize.L,
    label: 'Grande',
    minPlayers: 2,
    maxPlayers: 6,
  },
];

export const getPlayersLabel = (option: GameSizeOption): string => {
  if (option.minPlayers === option.maxPlayers) {
    return `${option.minPlayers} joueurs`;
  }
  return `${option.minPlayers} a ${option.maxPlayers} joueurs`;
};
