import { Component, HostListener } from '@angular/core';
import { MouseButton, ObjectType, TileType } from '@common/enum';
import { EditorStateService } from 'src/app/services/editor-state.service';

@Component({
  selector: 'app-editor-canvas',
  templateUrl: './editor-canvas.component.html',
  styleUrls: ['./editor-canvas.component.scss'],
})
export class EditorCanvasComponent {
  /* =========================================================
     Template helpers
     - Expose enums so the HTML can compare values safely:
       e.g. cell.tileType === tileType.DOOR
     ========================================================= */
  readonly tileType = TileType;
  readonly objectType = ObjectType;

  /* =========================================================
     UI state
     ========================================================= */
  // Used to apply .hovered class in the template
  hoveredIndex: number | null = null;

  // Drag-paint state (true while mouse is held down and tile tool is active)
  isPainting = false;

  // Used to track SHIFT key state for right-click removal of objects
  isShiftPressed = false;

  // Used to track mouse button state globally
  activeButton: MouseButton | null = null;

  @HostListener('document:keydown.shift', ['$event'])
  onShiftDown(event: Event): void {
    this.isShiftPressed = true;
  }

  @HostListener('document:keyup.shift', ['$event'])
  onShiftUp(event: Event): void {
    this.isShiftPressed = false;
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
     Hover / feedback
     ========================================================= */
  onCellHover(index: number | null): void {
    // Called on mouseleave of a cell
    this.hoveredIndex = index;
  }

  onCellMouseEnter(index: number): void {
    // Update hover visuals immediately
    this.hoveredIndex = index;

    // Drag-paint behavior:
    // - Only active when isPainting = true (set on mousedown)
    // - We restrict drag painting to tiles (not objects)
    if (this.isPainting) {
      switch (this.activeButton) {
        case MouseButton.Left:
          this.editorState.applyAtIndex(index);
          break;
        case MouseButton.Right:
          if (this.isShiftPressed) return; // Disables drag-erase for objects
          this.editorState.eraseTileAtIndex(index);
          break;
      }
    }
  }

  /* =========================================================
     Drag interactions (paint tiles)
     ========================================================= */

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

  onCellMouseDown(index: number, event: MouseEvent): void {
    // Prevent text selection
    event.preventDefault();

    this.activeButton = event.button;

    // Respond to left-click (0 = main button)
    switch (this.activeButton) {
      case MouseButton.Left:
        // Enable drag painting ONLY if we're applying tiles
        this.isPainting = this.canPaintTiles();

        // Always apply once immediately on press:
        // - supports normal click placement
        // - gives instant feedback even before dragging
        this.editorState.applyAtIndex(index);

        break;

      case MouseButton.Right:
        // SHIFT + Right-click: remove object at index
        if (this.isShiftPressed) {
          this.editorState.eraseObjectAtIndex(index);
          return;
        }

        // Right-click: remove tile at index
        // Enables drag-erase behavior for tiles
        this.isPainting = true;
        this.editorState.eraseTileAtIndex(index);

        break;

      default:
        return;
    }
  }

  onCellMouseUp(): void {
    // Stop drag painting when mouse is released anywhere inside the grid
    this.isPainting = false;

    // Reset active button
    this.activeButton = null;
  }

  onGridLeave(): void {
    // Safety: if user drags outside the grid, stop painting
    this.isPainting = false;

    // Reset active button
    this.activeButton = null;
  }
}
