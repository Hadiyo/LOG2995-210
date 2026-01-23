import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GAME_SIZE_CONFIG, GameSizeOption, getPlayersLabel } from '@app/config/game-size.config';
import { CreateGameDialogResult } from '@app/interfaces/create-game-dialog';
import { GameMode, MapSize } from '@common/enum';

const GAME_MODE_OPTIONS = [
  { value: GameMode.CLASSIC, label: 'Classique' },
  { value: GameMode.CTF, label: 'CTF' },
] as const;

@Component({
  selector: 'app-create-game-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './create-game-dialog.component.html',
  styleUrl: './create-game-dialog.component.scss',
})
export class CreateGameDialogComponent {
  readonly sizeOptions = GAME_SIZE_CONFIG;
  readonly modeOptions = GAME_MODE_OPTIONS;

  selectedSize?: MapSize;
  selectedMode?: GameMode;

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<CreateGameDialogResult>();

  getPlayersLabel(option: GameSizeOption): string {
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
