import { Component } from '@angular/core';
import { EditorTileComponent } from '@app/components/editor/editor-tile/editor-tile.component';
import { MouseEventType } from '@common/enum';
import { TileEvent } from '@common/types';
import { EditorStateService } from 'src/app/services/editor-state.service';

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
  handleTileEvent(event: TileEvent) {
    switch (event.type) {
      case MouseEventType.CLICK:
        this.onCellClick(event.index);
        break;
      case MouseEventType.UP:
        this.onCellMouseUp();
        break;
      case MouseEventType.DOWN:
        this.onCellMouseDown(event.index, event.originalEvent);
        break;
      case MouseEventType.ENTER:
        this.onCellMouseEnter(event.index);
        break;
      case MouseEventType.LEAVE:
        this.onGridLeave();
        break;
    }
  }

  /* =========================================================
     Click (single action)
     ========================================================= */
  private onCellClick(index: number): void {
    // Click is ONLY for the mouse tool (inspect).
    // Applicator uses mousedown + drag painting, so we do nothing here.
    if (this.editorState.selectedTool() === 'mouse') {
      this.editorState.inspectCellByIndex(index);
    }
  }

  /* =========================================================
     Drag interactions (paint tiles)
     ========================================================= */
  private onCellMouseEnter(index: number): void {
    // Drag-paint behavior:
    // - Only active when isPainting = true (set on mousedown)
    // - We restrict drag painting to tiles (not objects)
    if (this.isPainting) {
      this.editorState.applyAtIndex(index);
    }
  }

  /**
   * Returns true when we are in a mode that supports drag painting for tiles.
   * Used to conditionally enable drag painting on mousedown.
   */
  private canPaintTiles(): boolean {
    return (
      this.editorState.selectedTool() === 'applicator' &&
      this.editorState.selectedTileType() !== null
    );
  }

  onCellMouseDown(index: number, event: MouseEvent): void {
    // Only respond to left-click (0 = main button)
    if (event.button !== 0) return;

    // Prevent text selection
    event.preventDefault();

    // Mouse tool: treat press like inspect
    if (this.editorState.selectedTool() === 'mouse') {
      this.editorState.inspectCellByIndex(index);
      return;
    }

    // Enable drag painting ONLY if we're applying tiles
    this.isPainting = this.canPaintTiles();

    // Always apply once immediately on press:
    // - supports normal click placement
    // - gives instant feedback even before dragging
    this.editorState.applyAtIndex(index);
  }

  onCellMouseUp(): void {
    // Stop drag painting when mouse is released anywhere inside the grid
    this.isPainting = false;
  }

  onGridLeave(): void {
    // Safety: if user drags outside the grid, stop painting
    this.isPainting = false;
  }
}
