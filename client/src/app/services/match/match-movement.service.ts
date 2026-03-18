import { Injectable } from '@angular/core';
import { InitializedMatch } from '@common/game/match.interface';
import { TileType } from '@common/maps/map.enums';
import { EditorCell, Vec2 } from '@common/maps/map.interface';
import { positionKey, samePosition } from './match-geometry';

export type MovementDirection = 'up' | 'down' | 'left' | 'right';

export interface MovementAttemptResult {
    success: boolean;
    cost: number;
    destination: Vec2 | null;
    reason: string | null;
}

interface TraversalNode {
    position: Vec2;
    cost: number;
}

const DIRECTION_OFFSETS: Record<MovementDirection, Vec2> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

@Injectable({ providedIn: 'root' })
export class MatchMovementService {
    public getDestination(position: Vec2, direction: MovementDirection): Vec2 {
        const offset = DIRECTION_OFFSETS[direction];
        return {
            x: position.x + offset.x,
            y: position.y + offset.y,
        };
    }

    public getMovementCost(match: InitializedMatch, destination: Vec2, movingPlayerId: string): number | null {
        const cell = this.getCell(match, destination);
        if (!cell) return null;
        if (cell.tileType === TileType.WALL) return null;
        if (cell.tileType === TileType.DOOR && !cell.isWalkable) return null;
        if (this.isOccupiedByAnotherPlayer(match, destination, movingPlayerId)) return null;

        switch (cell.tileType) {
            case TileType.ICE:
                return 0;
            case TileType.WATER:
                return 2;
            case TileType.DOOR:
            case TileType.DIRT:
                return 1;
            default:
                return 1;
        }
    }

    public tryMove(match: InitializedMatch, playerId: string, direction: MovementDirection, movementPointsRemaining: number): MovementAttemptResult {
        const player = match.players.find((candidate) => candidate.id === playerId);
        if (!player) {
            return { success: false, cost: 0, destination: null, reason: 'PLAYER_NOT_FOUND' };
        }

        const destination = this.getDestination(player.position, direction);
        const cost = this.getMovementCost(match, destination, playerId);
        if (cost === null) {
            return { success: false, cost: 0, destination, reason: 'BLOCKED_TILE' };
        }

        if (cost > movementPointsRemaining) {
            return { success: false, cost, destination, reason: 'INSUFFICIENT_MOVEMENT_POINTS' };
        }

        return {
            success: true,
            cost,
            destination,
            reason: null,
        };
    }

    public getReachableTiles(match: InitializedMatch, playerId: string, movementPointsAvailable: number): Map<string, number> {
        const player = match.players.find((candidate) => candidate.id === playerId);
        const start = player?.position;
        if (!player || !start) {
            return new Map();
        }

        const distances = new Map<string, number>([[positionKey(start), 0]]);
        const frontier: TraversalNode[] = [{ position: start, cost: 0 }];

        while (frontier.length > 0) {
            frontier.sort((left, right) => left.cost - right.cost);
            const current = frontier.shift();
            if (!current) {
                continue;
            }
            const currentKey = positionKey(current.position);

            if (current.cost !== distances.get(currentKey)) continue;

            for (const direction of Object.keys(DIRECTION_OFFSETS) as MovementDirection[]) {
                const nextPosition = this.getDestination(current.position, direction);
                const stepCost = this.getMovementCost(match, nextPosition, playerId);
                if (stepCost === null) continue;

                const nextCost = current.cost + stepCost;
                const nextKey = positionKey(nextPosition);
                if (nextCost > movementPointsAvailable) continue;
                if (nextCost >= (distances.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;

                distances.set(nextKey, nextCost);
                frontier.push({ position: nextPosition, cost: nextCost });
            }
        }

        return distances;
    }

    private getCell(match: InitializedMatch, position: Vec2): EditorCell | null {
        return match.map.find((cell) => samePosition(cell.position, position)) ?? null;
    }

    private isOccupiedByAnotherPlayer(match: InitializedMatch, position: Vec2, movingPlayerId: string): boolean {
        return match.players.some((player) => player.id !== movingPlayerId && samePosition(player.position, position));
    }

}
