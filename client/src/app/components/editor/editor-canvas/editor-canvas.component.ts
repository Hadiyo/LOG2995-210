import { Component, HostListener } from '@angular/core';
import { EditorTileComponent } from '@app/components/editor/editor-tile/editor-tile.component';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { MouseButton, MouseEventType } from '@common/enum';
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

  // Global mouseup listener to catch releases outside the grid
  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.onCellMouseUp();
  }
}
