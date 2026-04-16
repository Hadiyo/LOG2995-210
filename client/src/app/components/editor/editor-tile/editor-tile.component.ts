import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ObjectType, TileType } from '@common/maps/map.enums';
import { MouseEventType } from '@common/mouse-events.enum';
import type { EditorCell, MapObject } from '@common/maps/map.interface';
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

  protected readonly tileType = TileType;
  protected readonly mouseEvent = MouseEventType;
  private readonly objectDescriptionByType: Record<ObjectType, string> = {
    [ObjectType.START]: "Un joueur est assigne aleatoirement un point de depart au debut d'une partie.",
    [ObjectType.FLAG]: "L'objectif principal du mode CTF. Pour gagner, un joueur doit revenir sur son point de depart avec le drapeau.",
    [ObjectType.REGEN]: 'Activer pour regagner 2 points de vie au joueur sans depasser le maximum.',
    [ObjectType.ARENA]: 'Activer pour obtenir un bonus temporaire de +1 en attaque et +1 en defense.',
  };

  protected isHovered = false;

  /* =========================================================
    Tile Event Logic
    ========================================================= */

  // All complex signal responses are sent to the canvas for global processing
  protected onMouseEvent(eventType: MouseEventType, event: MouseEvent) {
    this.toggleHoverState(eventType);
    this.tileEvent.emit({ type: eventType, index: this.index, originalEvent: event });
  }

  private toggleHoverState(eventType: MouseEventType): void {
    if (eventType === MouseEventType.ENTER)
      this.isHovered = true;
    else if (eventType === MouseEventType.LEAVE)
      this.isHovered = false;
  }

  protected objectDescription(object: MapObject | null): string | null {
    if (!object) return null;
    return this.objectDescriptionByType[object.type];
  }

  protected shouldRenderObject(object: MapObject | null): boolean {
    if (!object) return false;
    return this.tile.position.x === object.position.x && this.tile.position.y === object.position.y;
  }

}
