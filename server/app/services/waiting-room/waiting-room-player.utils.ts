import { AVATAR_IDS, CHARACTER_BASE_ATTRIBUTES, CHARACTER_PLUS_TWO_VALUE } from '@common/character/character.model';
import { MatchLobbyPlayer, VirtualPlayerProfile } from '@common/game/match.interface';
import { BOT_NAME_POOL } from './waiting-room.constants';
import { WaitingRoom } from './waiting-room.types';

const COIN_FLIP_THRESHOLD = 0.5;

export function findWaitingRoomAccessCode(rooms: Iterable<WaitingRoom>, socketId: string): string | undefined {
    for (const room of rooms) {
        if (room.socketToPlayerId.has(socketId)) {
            return room.accessCode;
        }
    }

    return undefined;
}

export function resolveUniqueWaitingRoomPlayerName(name: string, room: WaitingRoom): string {
    const existingNames = new Set(room.players.map((player) => player.name));
    if (!existingNames.has(name)) {
        return name;
    }

    let suffix = 2;
    let candidate = `${name}-${suffix}`;
    while (existingNames.has(candidate)) {
        suffix += 1;
        candidate = `${name}-${suffix}`;
    }
    return candidate;
}

export function buildWaitingRoomVirtualPlayer(room: WaitingRoom, profile: VirtualPlayerProfile): MatchLobbyPlayer {
    const usedAvatarIds = new Set(room.players.map((player) => player.avatarId));
    const avatarId = shuffle(AVATAR_IDS)
        .find((candidate) => !usedAvatarIds.has(candidate)) ?? AVATAR_IDS[room.players.length % AVATAR_IDS.length];
    const baseName = BOT_NAME_POOL[Math.floor(Math.random() * BOT_NAME_POOL.length)] ?? 'Bot';
    const healthBoosted = Math.random() < COIN_FLIP_THRESHOLD;
    const attackBoosted = Math.random() < COIN_FLIP_THRESHOLD;

    return {
        id: crypto.randomUUID(),
        name: resolveUniqueWaitingRoomPlayerName(baseName, room),
        avatarId,
        isOrganizer: false,
        speed: CHARACTER_BASE_ATTRIBUTES.speed + (healthBoosted ? 0 : CHARACTER_PLUS_TWO_VALUE),
        maxHealth: CHARACTER_BASE_ATTRIBUTES.health + (healthBoosted ? CHARACTER_PLUS_TWO_VALUE : 0),
        baseAttack: CHARACTER_BASE_ATTRIBUTES.attack,
        baseDefense: CHARACTER_BASE_ATTRIBUTES.defense,
        attackDie: attackBoosted ? 'D6' : 'D4',
        defenseDie: attackBoosted ? 'D4' : 'D6',
        controller: 'virtual',
        virtualProfile: profile,
    };
}

function shuffle<T>(values: readonly T[]): T[] {
    const next = [...values];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }

    return next;
}
