import { AvatarId, Die, PlusTwoAttributeName } from './character.model';

// Bonuses that a character receives based on their choices during creation
export interface CharacterBonuses {
  plusTwo: PlusTwoAttributeName;
  attaqueDie: Die;
  defenseDie: Die;
}

// Basic character information needed for display and gameplay
export interface Character {
  name: string;
  avatarId: AvatarId;
  bonuses: CharacterBonuses;
}
