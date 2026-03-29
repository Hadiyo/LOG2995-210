import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameTileInfoModalData } from '@app/components/game/game-tile-info-modal/game-tile-info-modal.interface';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import { TileType } from '@common/maps/map.enums';

@Component({
  selector: 'app-game-tile-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-tile-info-modal.component.html',
  styleUrl: './game-tile-info-modal.component.scss',
})
export class GameTileInfoModalComponent {
  // Modal content built from the clicked cell.
  @Input({ required: true }) tileInfo!: GameTileInfoModalData;
  // Close event forwarded to the parent page.
  @Output() close = new EventEmitter<void>();
  // Expose tile enum so the template can bind preview selectors.
  readonly tileType = TileType;

  // Use the avatar thumbnails.
  getAvatarThumbPath(avatarId: number): string {
    return resolveAssetUrl(`assets/avatars/thumbs/${avatarId}.png`);
  }

  getVirtualPlayerLabel(): string | null {
    if (this.tileInfo.playerController !== 'virtual') {
      return null;
    }

    return this.tileInfo.playerVirtualProfile === 'defensive' ? 'JV defensif' : 'JV agressif';
  }

  // Close the modal from the overlay or button.
  onClose(): void {
    this.close.emit();
  }

  // Right click on the empty backdrop should behave like a close action.
  onBackdropContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.onClose();
  }

  // Right click inside the panel should only block the browser menu and stop propagation.
  onPanelContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
