import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { TileType } from '@common/maps/map.enums';
import { getGameSessionObjectCovering } from './game-session.match';
import { GameSessionRuntime } from './game-session.runtime';

export function canUseDebugTeleport(
    session: GameSessionRuntime | undefined,
    player: MatchPlayer | null | undefined,
    playerId: string,
): session is GameSessionRuntime {
    return !!session &&
        !!player &&
        session.match.debugMode &&
        session.turnState.phase === 'active' &&
        session.turnState.activePlayerId === playerId &&
        !session.match.endState;
}

export function isDebugTeleportDestinationAvailable(
    match: InitializedMatch,
    playerId: string,
    position: { x: number; y: number },
): boolean {
    const targetCell = match.map.find(
        (cell) => cell.position.x === position.x && cell.position.y === position.y,
    );
    if (!targetCell || targetCell.tileType === TileType.WALL || (targetCell.tileType === TileType.DOOR && !targetCell.isWalkable)) {
        return false;
    }

    const occupiedByPlayer = match.players.some(
        (candidate) => candidate.id !== playerId && candidate.position.x === position.x && candidate.position.y === position.y,
    );
    if (occupiedByPlayer) {
        return false;
    }

    return !getGameSessionObjectCovering(match.objects, position);
}
