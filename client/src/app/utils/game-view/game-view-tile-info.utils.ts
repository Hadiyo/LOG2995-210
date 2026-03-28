import { computed, Signal } from '@angular/core';
import { GameTileInfoModalData } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.interface';
import { buildTileInfoModalData } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.utils';
import { MatchTileInspection } from '@common/game/match.interface';
import { GameCell, MapObject } from '@common/maps/map.interface';
import { Player } from '@common/player/player.interface';

export function createSelectedTileInfo(
    inspectedTile: Signal<MatchTileInspection | null>,
    mapCells: Signal<readonly GameCell[]>,
    mapObjects: Signal<readonly MapObject[]>,
    players: Signal<readonly Player[]>,
): Signal<GameTileInfoModalData | null> {
    return computed(() => {
        const tileDetails = inspectedTile();
        if (!tileDetails) {
            return null;
        }

        const cell = mapCells().find(
            (candidate) =>
                candidate.position.x === tileDetails.position.x &&
                candidate.position.y === tileDetails.position.y,
        );

        return cell ? buildTileInfoModalData(cell, mapObjects(), players()) : null;
    });
}
