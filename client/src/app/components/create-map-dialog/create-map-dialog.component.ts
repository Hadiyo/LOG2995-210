import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GAME_MODE_OPTIONS, getPlayersLabel, MAP_SIZE_CONFIG, MapConfig } from '@app/config/map.config';
import { GameMode, MapSize } from '@common/maps/map.enums';

@Component({
  selector: 'app-create-map-dialog',
  imports: [FormsModule],
  templateUrl: './create-map-dialog.component.html',
  styleUrl: './create-map-dialog.component.scss',
})
export class CreateMapDialogComponent {
  protected readonly sizeOptions = MAP_SIZE_CONFIG;
  protected readonly modeOptions = GAME_MODE_OPTIONS;

  protected selectedSize: MapSize = MAP_SIZE_CONFIG[0].value;
  protected selectedMode: GameMode = GAME_MODE_OPTIONS[0].value;

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<MapConfig>();

  protected readonly getPlayersLabel = getPlayersLabel;

  protected onCancel(): void {
    this.cancel.emit();
  }

  protected onConfirm(): void {
    this.confirm.emit({
      size: this.selectedSize,
      mode: this.selectedMode,
    });
  }
}
