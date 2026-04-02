import { InitializedMatch, MatchPlayer, MatchTeamId } from './match.interface';
import { GameMode, ObjectType } from '../maps/map.enums';
import { MapObject, Vec2 } from '../maps/map.interface';

function samePosition(left: Vec2, right: Vec2): boolean {
    return left.x === right.x && left.y === right.y;
}

export function resolveFlagCarrier(match: InitializedMatch, playerId: string, position: Vec2): string | null {
    if (match.flagCarrierId) {
        return match.flagCarrierId;
    }

    if (match.mode !== GameMode.CTF) {
        return null;
    }

    const flagObject = match.allObjects.find((object) => object.type === ObjectType.FLAG);
    if (!flagObject) {
        return null;
    }

    return samePosition(flagObject.position, position) ? playerId : null;
}

export function buildTeamAssignments(playerCount: number, mode: GameMode, random: () => number): (MatchTeamId | null)[] {
    if (mode !== GameMode.CTF || playerCount < 2 || playerCount % 2 !== 0) {
        return Array.from({ length: playerCount }, () => null);
    }

    const assignments: (MatchTeamId | null)[] = Array.from({ length: playerCount }, () => null);
    const shuffledIndexes = shuffle(Array.from({ length: playerCount }, (_, index) => index), random);
    const playersPerTeam = playerCount / 2;

    shuffledIndexes.forEach((playerIndex, orderIndex) => {
        assignments[playerIndex] = orderIndex < playersPerTeam ? 'A' : 'B';
    });

    return assignments;
}

export function buildVisibleObjects(
    objects: InitializedMatch['allObjects'],
    players: MatchPlayer[],
    flagCarrierId: string | null,
): MapObject[] {
    const activeStarts = new Set(players.map((player) => `${player.startingPosition.x}:${player.startingPosition.y}`));

    return objects
        .filter((object) => {
            if (object.type === ObjectType.START) {
                return activeStarts.has(`${object.position.x}:${object.position.y}`);
            }

            if (object.type === ObjectType.FLAG) {
                return flagCarrierId === null;
            }

            return true;
        })
        .map((object) => ({ ...object, position: { ...object.position } }));
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
    const next = [...values];
    for (let index = next.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(random() * (index + 1));
        [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }
    return next;
}
