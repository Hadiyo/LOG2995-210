import {
  AvatarId,
  CHARACTER_NAME_MAX_LENGTH,
  DIE_TARGET_ATTRIBUTE_NAMES,
  DieTargetAttributeName,
  FAMILY_NAME_POOL,
  FIRST_NAME_POOL,
  MIDDLE_NAME_POOL,
  MIDDLE_NAME_PROBABILITY,
  PLUS_TWO_ATTRIBUTE_NAMES,
  PlusTwoAttributeName,
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
export function makeFullName(takenNames: string[]): string {
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

  const finalName = validatePlayerName(full,takenNames);

  return finalName;
}

// Generate random character form possible values
export function generateCharacterFormValues(takenNames: string[], availableAvatar: AvatarId[]): GeneratedCharacterFormValues {
  return {
    name: makeFullName(takenNames),
    avatarId: pickOne(availableAvatar),
    plusTwo: pickOne(PLUS_TWO_ATTRIBUTE_NAMES),
    d6GoesTo: pickOne(DIE_TARGET_ATTRIBUTE_NAMES),
  };
}

// Remove invalid characters and collapse multiple spaces/hyphens/apostrophes for cleaner input
export function sanitizeCharacterName(value: string): string {
  return value
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9'’ -]/g, '')
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

export function validatePlayerName(originalName: string, takenNames: string[]): string {
  // Match optional suffix like "-2", "-3", etc.
  const suffixRegex = new RegExp(`^${originalName}-(\\d+)$`);

  // Find max suffix
  let maxSuffix = 0;
  takenNames.forEach(name => {
    if (name === originalName) {
      maxSuffix = Math.max(maxSuffix, 1); // treat base name as 1
    } else {
      const match = name.match(suffixRegex);
      if (match) {
        maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
      }
    }
  });

  // Return base name or add next suffix with "-"
  return maxSuffix === 0 ? originalName : `${originalName}-${maxSuffix + 1}`;
}

