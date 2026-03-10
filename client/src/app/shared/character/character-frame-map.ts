import { CharacterDirection, CharacterState } from './character.types';

// Build a string-key type like:
// 'idleFront' | 'idleRight' | ... | 'deadLeft'
export type CharacterFrameKey = `${CharacterState}${Capitalize<CharacterDirection>}`;

// Static mapping from (state + direction) to frame index in a 4x4 sheet.
// Indexes are row-major: first row 0..3, second row 4..7,
export const CHARACTER_FRAME_MAP: Record<CharacterFrameKey, number> = {
    // Row 0: idle
    idleFront: 0,
    idleRight: 1,
    idleBack: 2,
    idleLeft: 3,
    
    // Row 1: walk
    walkFront: 4,
    walkRight: 5,
    walkBack: 6,
    walkLeft: 7,

    // Row 2: attack
    attackFront: 8,
    attackRight: 9,
    attackBack: 10,
    attackLeft: 11,

    // Row 3: dead
    deadFront: 12,
    deadRight: 13,
    deadBack: 14,
    deadLeft: 15,
};

// Public helper used by renderer:
// 1) Build key like 'walkLeft'
// 2) Return matching frame index from the map.
export const getFrameIndex = (state: CharacterState, direction: CharacterDirection): number => {
    // Convert lowercase direction ('front') to capitalized suffix ('Front')
    const key = `${state}${direction.charAt(0).toUpperCase()}${direction.slice(1)}` as CharacterFrameKey;
    return CHARACTER_FRAME_MAP[key];
};
