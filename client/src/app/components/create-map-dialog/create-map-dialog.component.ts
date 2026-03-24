import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getPlayersLabel, MAP_SIZE_CONFIG, MapConfig } from '@app/config/map.config';
import { GameMode, MapSize } from '@common/maps/map.enums';

const MODE_OPTIONS = [
  { value: GameMode.CLASSIC, label: 'Classique' },
  { value: GameMode.CTF, label: 'CTF' },
] as const;

@Component({
  selector: 'app-create-map-dialog',
  imports: [FormsModule],
  templateUrl: './create-map-dialog.component.html',
  styleUrl: './create-map-dialog.component.scss',
})
export class CreateMapDialogComponent {
  protected readonly sizeOptions = MAP_SIZE_CONFIG;
  protected readonly modeOptions = MODE_OPTIONS;

  protected selectedSize: MapSize = MAP_SIZE_CONFIG[0].value;
  protected selectedMode: GameMode = MODE_OPTIONS[0].value;

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
