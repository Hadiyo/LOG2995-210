import { Injectable, signal } from '@angular/core';
import { GameTileInfoModalData } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.interface';
import { buildTileInfoModalData } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.utils';
import { GameCell, MapObject } from '@common/maps/map.interface';
import { Player } from '@common/player/player.interface';

@Injectable({
  providedIn: 'root',
})
export class GameTileInfoService {
  // Shared modal state for tile information in the game view.
  readonly selectedTileInfo = signal<GameTileInfoModalData | null>(null);

  // Build and open the tile info modal for the clicked cell.
  openTileInfo(cell: GameCell | undefined, objects: readonly MapObject[], players: readonly Player[]): void {
    if (!cell) return;
    this.selectedTileInfo.set(buildTileInfoModalData(cell, objects, players));
  }

  // Close the currently opened tile info modal.
  closeTileInfo(): void {
    this.selectedTileInfo.set(null);
  }
}
