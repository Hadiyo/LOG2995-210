import { MapSize } from '@common/enum';

export type MapSizeOption = {
  value: MapSize;
  label: string;
  minPlayers: number;
  maxPlayers: number;
};

export const MAP_SIZE_CONFIG: readonly MapSizeOption[] = [
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

export const getPlayersLabel = (option: MapSizeOption): string => {
  if (option.minPlayers === option.maxPlayers) {
    return `${option.minPlayers} joueurs`;
  }
  return `${option.minPlayers} a ${option.maxPlayers} joueurs`;
};
