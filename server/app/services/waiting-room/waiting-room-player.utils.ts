import { WaitingRoom } from './waiting-room.types';

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
