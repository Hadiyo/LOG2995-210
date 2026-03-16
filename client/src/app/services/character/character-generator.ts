import {
  DIE_TARGET_ATTRIBUTE_NAMES,
  PLUS_TWO_ATTRIBUTE_NAMES,
  AvatarId,
  DieTargetAttributeName,
  PlusTwoAttributeName,
  FAMILY_NAME_POOL,
  FIRST_NAME_POOL,
  CHARACTER_NAME_MAX_LENGTH,
  MIDDLE_NAME_POOL,
  MIDDLE_NAME_PROBABILITY,
} from '@common/character/character.model';

// Types for the character form values that will be generated
export type GeneratedCharacterFormValues = {
  name: string;
  avatarId: AvatarId;
  plusTwo: PlusTwoAttributeName;
  d6GoesTo: DieTargetAttributeName;
};

// Utility function to pick a random item from a readonly array
function pickOne<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

// Generate a random full name with a chance for a middle name, 
// ensuring it doesn't exceed the max length
export function makeFullName(): string {
  const includeMiddle = Math.random() < MIDDLE_NAME_PROBABILITY;
  const first = pickOne(FIRST_NAME_POOL);
  const last = pickOne(FAMILY_NAME_POOL);

  let full = `${first} ${last}`;

  if (includeMiddle) {
    const middle = pickOne(MIDDLE_NAME_POOL);
    const candidate = `${first} ${middle} ${last}`;
    if (candidate.length <= CHARACTER_NAME_MAX_LENGTH) {
      full = candidate;
    }
  }

  return full;
}

// Generate random character form possible values
export function generateCharacterFormValues(availableAvatar: AvatarId[]): GeneratedCharacterFormValues {
  return {
    name: makeFullName(),
    avatarId: pickOne(availableAvatar),
    plusTwo: pickOne(PLUS_TWO_ATTRIBUTE_NAMES),
    d6GoesTo: pickOne(DIE_TARGET_ATTRIBUTE_NAMES),
  };
}

// Remove invalid characters and collapse multiple spaces/hyphens/apostrophes for cleaner input
export function sanitizeCharacterName(value: string): string {
  return value
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’ -]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/'{2,}/g, "'")
    .replace(/’{2,}/g, '’')
    .trimStart();
}

// Trim name and replace multiple spaces with a single space to ensure clean formatting
export function normalizeCharacterName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

