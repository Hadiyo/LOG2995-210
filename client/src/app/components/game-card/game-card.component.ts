import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { getGameModeLabel } from '@app/config/map.config';
import type { MapSummary } from '@common/maps/map.interface';

@Component({
  selector: 'app-game-card',
  imports: [DatePipe],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
  @Input({ required: true }) map!: MapSummary;
  @Input() showActions = true;
  @Output() select = new EventEmitter<string>();
  @Output() edit = new EventEmitter<MapSummary>();
  @Output() remove = new EventEmitter<MapSummary>();
  @Output() toggleVisibility = new EventEmitter<MapSummary>();

  protected get modeLabel(): string {
    return getGameModeLabel(this.map.mode);
  }

  protected onEdit(): void {
    this.edit.emit(this.map);
  }

  protected onSelect(): void {
    this.select.emit(this.map.id);
  }

  protected onRemove(): void {
    this.remove.emit(this.map);
  }

  protected onToggleVisibility(): void {
    this.toggleVisibility.emit(this.map);
  }
}
