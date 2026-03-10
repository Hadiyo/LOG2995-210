import { getCellPositionAtIndex } from '@common/maps/map-utils';
import { ObjectType } from '@common/maps/map.enums';
import { EditorMap, GameMap } from '@common/maps/map.interface';
import { GamePlayerState, PlayerStatus } from '@common/player/player.interface';
import { DEFAULT_ACTIONS_PER_TURN } from './local-game.constants';

export const applyRuntimePlayerDefaults = (players: GamePlayerState[]): GamePlayerState[] => {
    return players.map((player) => ({
        ...player,
        status: player.status ?? PlayerStatus.Active,
        facing: player.facing ?? 'front',
        pose: player.pose ?? 'idle',
        remainingMovement: player.remainingMovement ?? player.attributes.speed,
        remainingActions: player.remainingActions ?? DEFAULT_ACTIONS_PER_TURN,
    }));
};

export const assignInitialPositions = (players: GamePlayerState[], map: GameMap): GamePlayerState[] => {
    const spawnPositions = map.objects
        .filter((object) => object.type === ObjectType.START)
        .map((object) => ({ ...object.position }));
    const walkablePositions = map.map.filter((cell) => cell.isWalkable).map((cell) => ({ ...cell.position }));

    return players.map((player, index) => ({
        ...player,
        position:
            player.position ??
            spawnPositions[index] ??
            walkablePositions[index] ??
            walkablePositions[0] ??
            { x: 0, y: 0 },
    }));
};

export const toGameMapState = (map: EditorMap): GameMap => {
    return {
        id: map.id,
        name: map.name,
        size: map.size,
        mode: map.mode,
        objects: map.objects,
        map: map.map.map((cell, index) => ({
            ...cell,
            position: getCellPositionAtIndex(index, map.size),
        })),
    };
};
