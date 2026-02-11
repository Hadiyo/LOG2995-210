import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { EditorMap } from '@common/interface';
import { GameMode } from '@common/enum';

@Component({
  selector: 'app-game-card',
  imports: [DatePipe],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  @Input({ required: true }) map!: EditorMap;
  @Input() thumbnailUrl?: string;
  @Input() showActions = true;
  @Output() select = new EventEmitter<EditorMap>();
  @Output() edit = new EventEmitter<EditorMap>();
  @Output() remove = new EventEmitter<EditorMap>();
  @Output() toggleVisibility = new EventEmitter<EditorMap>();

  readonly modeLabels: Record<GameMode, string> = {
    [GameMode.CLASSIC]: 'Classique',
    [GameMode.CTF]: 'CTF',
  };

  get modeLabel(): string {
    return this.modeLabels[this.map.mode] ?? this.map.mode;
  }

  onEdit(): void {
    this.edit.emit(this.map);
  }

  onSelect(): void {
    this.select.emit(this.map);
  }

  onRemove(): void {
    this.remove.emit(this.map);
  }

  onToggleVisibility(): void {
    this.toggleVisibility.emit(this.map);
  }
}
