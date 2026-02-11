import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MouseEventType, TileType } from '@common/enum';
import { EditorCell, MapObject } from '@common/interface';
import { TileEvent } from '@common/types';

@Component({
  selector: 'app-editor-tile',
  imports: [],
  templateUrl: './editor-tile.component.html',
  styleUrls: ['./editor-tile.component.scss'],
})
export class EditorTileComponent {
  @Input() index!: number; // Index of the tile in the canva needed for communication
  @Input() tile!: EditorCell;
  @Input() object!: MapObject | null;

  @Output() tileEvent = new EventEmitter<TileEvent>();

  readonly tileType = TileType;
  readonly mouseEvent = MouseEventType;

  protected isHovered = false;

  /* =========================================================
    Tile Event Logic
    ========================================================= */

  // All complex signal responses are sent to the canvas for global processing
  onMouseEvent(eventType: MouseEventType, event: MouseEvent) {
    this.toggleHoverState(eventType);
    this.tileEvent.emit({ type: eventType, index: this.index, originalEvent: event });
  }

  private toggleHoverState(eventType: MouseEventType): void {
    if (eventType === MouseEventType.ENTER)
      this.isHovered = true;
    else if (eventType === MouseEventType.LEAVE)
      this.isHovered = false;
  }

}
