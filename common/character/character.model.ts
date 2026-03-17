export type Die = (typeof DICE)[number];
export type PlusTwoAttributeName = (typeof PLUS_TWO_ATTRIBUTE_NAMES)[number];
export type DieTargetAttributeName = (typeof DIE_TARGET_ATTRIBUTE_NAMES)[number];
export type AvatarId = (typeof AVATAR_IDS)[number];
export type AvatarProfile = {
  subtitle: string;
  description: string;
};

// The base attributes that every character starts with before applying bonuses
export const CHARACTER_BASE_ATTRIBUTES = {
  vie: 6,
  rapidite: 6,
  attaque: 4,
  defense: 4,
} as const;

// The maximum length for character names
export const CHARACTER_NAME_MAX_LENGTH = 25 as const;

// The value added to the chosen attribute when applying the +2 bonus
export const CHARACTER_PLUS_TWO_VALUE = 2 as const;
export const PLUS_TWO_ATTRIBUTE_NAMES = ['vie', 'rapidite'] as const;

// The list of dice options for attack and defense bonuses
export const DICE = ['D4', 'D6'] as const;
export const DIE_D4_SIDES = 4 as const;
export const DIE_D6_SIDES = 6 as const;
export const DIE_TARGET_ATTRIBUTE_NAMES = ['attaque', 'defense'] as const;

// The list of 12 avatar IDs available for character creation
export const AVATAR_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export const FIRST_NAME_POOL = [
  'Nova', 'Astra', 'Lyra', 'Orion', 'Kira', 'Mira',
  'Zane', 'Eden', 'Sora', 'Riven', 'Nox', 'Iris',
  'Alar', 'Cael', 'Varek', 'Milo', 'Tara', 'Vera',
  'Rian', 'Sela', 'Kian', 'Nysa', 'Tess', 'Dain',
] as const;

export const MIDDLE_NAME_POOL = [
  'Lion', 'Roi', 'Lys', 'Fer', 'Or', 'Lame',
  'Gris', 'Noir', 'Sang', 'Cuir', 'Fiel',
  'Tour', 'Pont', 'Bois', 'Rune', 'Sceau',
  'Aube', 'Nuit', 'Foi', 'Paix', 'Garde',
] as const;

export const MIDDLE_NAME_PROBABILITY = 0.5 as const; // %Chance to have a middle name

export const FAMILY_NAME_POOL = [
  'Voss', 'Crest', 'D’Arx', 'Thorn', 'Noct', 'Kael',
  'Vey', 'Rook', 'Maren', 'Hale', 'Vale', 'Solen',
  'Drake', 'Riven', 'Solin', 'Kade', 'Nyx', 'Venn',
  'Tarn', 'Sable', 'Vyre', 'Korr', 'Lune', 'Rath',
] as const;

// Basic character information needed for display only
export const AVATAR_PROFILES: Record<AvatarId, AvatarProfile> = {
  0: {
    subtitle: 'Chevalier Aether',
    description: 'Ancien écuyer devenu pilote d’armure‑lame. Sert la Couronne depuis les Croisades.',
  },
  1: {
    subtitle: 'Sentinelle d’Acier',
    description: 'Garde d’élite de la cour. Bouclier conçu pour absorber l’énergie des sièges orbitaux.',
  },
  2: {
    subtitle: 'Lancier d’Orbite',
    description: 'Lance au service de la couronne. Charge perçant les lignes ennemies comme un météore.',
  },
  3: {
    subtitle: 'Dame‑Forge',
    description: 'Maîtrise les lames sacrées. Armures portant les sceaux des forges reliquaires.',
  },
  4: {
    subtitle: 'Chevalier‑Spectre',
    description: 'Ombre aux reliques vibro. Traversée des champs de bataille sans laisser d’empreinte.',
  },
  5: {
    subtitle: 'Croisé du Néon',
    description: 'Serment alimentant les armes. Chaque vœu gravé illumine la visière d’un halo ardent.',
  },
  6: {
    subtitle: 'Lame Astrale',
    description: 'Vision à travers les failles stellaires. Guidées par les constellations sacrées.',
  },
  7: {
    subtitle: 'Gardien du Nexus',
    description: 'Protecteur des portails royaux. Serment de ne jamais laisser un seuil rebelles.',
  },
  8: {
    subtitle: 'Archiviste Stellaire',
    description: 'Porte les runes d’anciens ordres. Codes‑runes réveillant des tactiques oubliées.',
  },
  9: {
    subtitle: 'Chevalier‑Antenne',
    description: 'Relais vivant de l’escouade. Casque diffusant les ordres par liaisons quantiques.',
  },
  10: {
    subtitle: 'Dame du Sillage Bleu',
    description: 'Lame canalisant la lumière. Terrain marqué de traînées d’azur protectrices.',
  },
  11: {
    subtitle: 'Vigile Nocturne',
    description: 'Chasseur de fragments d’astrolabe. Veille aux frontières du royaume céleste.',
  },
};

