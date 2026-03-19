import { Vec2 } from '@common/maps/map.interface';

export const cloneVec2 = ({ x, y }: Vec2): Vec2 => ({ x, y });

export const positionKey = ({ x, y }: Vec2): string => `${x}:${y}`;

export const samePosition = (left: Vec2, right: Vec2): boolean =>
    left.x === right.x && left.y === right.y;

export const manhattanDistance = (left: Vec2, right: Vec2): number =>
    Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

export const shuffle = <T>(values: readonly T[], random: () => number): T[] => {
    const next = [...values];

    for (let index = next.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(random() * (index + 1));
        [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }

    return next;
};
