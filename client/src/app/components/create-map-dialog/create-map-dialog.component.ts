import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getPlayersLabel, MAP_SIZE_CONFIG, MapConfig, MapSizeOption } from '@app/config/map.config';
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
  readonly sizeOptions = MAP_SIZE_CONFIG;
  readonly modeOptions = MODE_OPTIONS;

  selectedSize: MapSize = MAP_SIZE_CONFIG[0].value; //Valeur par défaut
  selectedMode: GameMode = MODE_OPTIONS[0].value; //Valeur par défaut

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<MapConfig>();

  getPlayersLabel(option: MapSizeOption): string {
    return getPlayersLabel(option);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    this.confirm.emit({
      size: this.selectedSize,
      mode: this.selectedMode,
    });
  }
}
