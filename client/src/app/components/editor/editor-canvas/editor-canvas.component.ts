import { Component, HostListener, signal } from '@angular/core';
import { EditorTileComponent } from '@app/components/editor/editor-tile/editor-tile.component';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { CURSOR_OFFSET, OBJECTS } from '@app/shared/tooltip/tooltip.constants';
import { ObjectType } from '@common/maps/map.enums';
import { MouseButton, MouseEventType } from '@common/mouse-events.enum';
import { TileEvent } from '@common/types';

@Component({
  selector: 'app-editor-canvas',
  imports: [EditorTileComponent],
  templateUrl: './editor-canvas.component.html',
  styleUrls: ['./editor-canvas.component.scss'],
})
export class EditorCanvasComponent {
  /* =========================================================
     UI state
     ========================================================= */
  // Drag-paint state (true while mouse is held down and tile tool is active)
  private isPainting = false;

  // Current tooltip text and position
  tooltipText = signal<string | null>(null);
  tooltipX = signal(0);
  tooltipY = signal(0);

  // Tooltip text getter
  protected getDescription(objectId: ObjectType): string {
    if (!objectId) return '';
    return OBJECTS.find((object) => object.id === objectId)?.description ?? '';
  }

  // Track state of shift key
  @HostListener('document:keydown.shift')
  onShiftDown(): void {
    this.editorState.isShiftPressed.set(true);
  }

  @HostListener('document:keyup.shift')
  onShiftUp(): void {
    this.editorState.isShiftPressed.set(false);
  }

  // Assume all keys are released when window loses focus
  @HostListener('window:blur')
  onBlur() {
    this.editorState.isShiftPressed.set(false);
  }

  /* =========================================================
     Dependencies
     ========================================================= */
  // Keeping it readonly makes it clear we don't swap services at runtime
  readonly editorState: EditorStateService;

  constructor(editorState: EditorStateService) {
    // Store injected service for template + event handlers
    this.editorState = editorState;
  }

  /* =========================================================
     Tile Event Handler
     ========================================================= */

  private onCellMouseEnter(index: number): void {
    // Drag-paint behavior:
    // - Only active when isPainting = true (set on mousedown)
    // - We restrict drag painting to tiles (not objects)
    if (this.isPainting) {
      switch (this.editorState.activeButton()) {
        case MouseButton.Left:
          this.editorState.applyAtIndex(index);
          break;
        case MouseButton.Right:
          if (this.editorState.isShiftPressed()) {
            // SHIFT + Right-drag: remove object at index
            this.editorState.eraseObjectAtIndex(index);
            break;
          }
          this.editorState.eraseTileAtIndex(index);
          break;
      }
    } else {
      // Show tooltip on hover when not painting
      this.updateTooltip(index);
    }
  }

  handleTileEvent(event: TileEvent) {
    switch (event.type) {
      case MouseEventType.UP:
        this.onCellMouseUp();
        break;
      case MouseEventType.DOWN:
        this.onCellMouseDown(event.index, event.originalEvent);
        break;
      case MouseEventType.ENTER:
        this.onCellMouseEnter(event.index);
        break;
      case MouseEventType.MOVE:
        this.onCellMouseMove(event.index, event.originalEvent);
        break;
      case MouseEventType.LEAVE:
        this.onGridMouseLeave();
        break;
    }
  }

  /**
   * Returns true when we are in a mode that supports drag painting for tiles.
   * Used to conditionally enable drag painting on mousedown.
   */
  private canPaintTiles(): boolean {
    return (
      this.editorState.selectedTileType() !== null
    );
  }

  // Disables context menu on right click
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  private onCellMouseDown(index: number, event: MouseEvent): void {
    // Prevent text selection
    event.preventDefault();

    this.editorState.activeButton.set(event.button);

    // Respond to left-click (0 = main button)
    switch (this.editorState.activeButton()) {
      case MouseButton.Left:
        // Enable drag painting ONLY if we're applying tiles
        this.isPainting = this.canPaintTiles();

        // Always apply once immediately on press:
        // - supports normal click placement
        // - gives instant feedback even before dragging
        this.editorState.applyAtIndex(index);
        break;

      case MouseButton.Right:
        // Enables drag-erase behavior
        this.isPainting = true;

        // SHIFT + Right-click: remove object at index
        if (this.editorState.isShiftPressed()) {
          this.editorState.eraseObjectAtIndex(index);
          break;
        }

        // Right-click: remove tile at index
        this.editorState.eraseTileAtIndex(index);
        break;

      default:
        return;
    }
  }

  private onCellMouseUp(): void {
    // Stop drag painting when mouse is released anywhere inside the grid
    this.isPainting = false;

    // Reset active button
    this.editorState.activeButton.set(null);
  }

  protected onCellMouseMove(index: number, event: MouseEvent): void {
    if (this.isPainting) return;

    this.updateTooltip(index);
    this.tooltipX.set(event.clientX + CURSOR_OFFSET);
    this.tooltipY.set(event.clientY + CURSOR_OFFSET);
  }

  protected onGridMouseLeave(): void {
    this.tooltipText.set(null);
  }

  private updateTooltip(index: number) {
    const object = this.editorState.objectLookUp().get(index);
    if (!object) {
      this.tooltipText.set(null);
      return;
    }
  
    this.tooltipText.set(this.getDescription(object.type));
  }

  // Global mouseup listener to catch releases outside the grid
  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.onCellMouseUp();
  }
}
