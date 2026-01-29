import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GAME_SIZE_CONFIG, GameSizeOption, getPlayersLabel } from '@app/config/game-size.config';
import { MAP_SIZE_CONFIG, MapSizeOption } from '@app/config/map-size.config';
import { MapConfig } from '@app/interfaces/create-game-dialog';
import { GameMode, MapSize } from '@common/enum';

const MODE_OPTIONS = [
  { value: GameMode.CLASSIC, label: 'Classique' },
  { value: GameMode.CTF, label: 'CTF' },
] as const;

@Component({
  selector: 'app-create-map-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './create-map-dialog.component.html',
  styleUrl: './create-map-dialog.component.scss',
})
export class CreateMapDialogComponent {
  readonly sizeOptions = MAP_SIZE_CONFIG;
  readonly modeOptions = MODE_OPTIONS;

  selectedSize?: MapSize;
  selectedMode?: GameMode;

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<MapConfig>();

  getPlayersLabel(option: MapSizeOption): string {
    return getPlayersLabel(option);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    if (!this.selectedSize || !this.selectedMode) {
      return;
    }

    this.confirm.emit({
      size: this.selectedSize,
      mode: this.selectedMode,
    });
  }
}
