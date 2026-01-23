import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

import { GameMode, MapSize } from '@common/enum';
import { validateGame } from '@common/game-validation';
import { EditorStateService, EditorToolId } from 'src/app/services/editor-state.service';

@Component({
  selector: 'app-editor-topbar',
  standalone: true,

  /**
   * Standalone component imports:
   * - CommonModule: structural directives and common Angular features
   */
  imports: [CommonModule],

  templateUrl: './editor-topbar.component.html',
  styleUrls: ['./editor-topbar.component.scss'],
})
export class EditorTopbarComponent {
  /* =========================================================
     Template helpers
     ========================================================= */
  // Expose enums so the template can compare values safely
  readonly gameMode = GameMode;
  readonly mapSize = MapSize;

  /* =========================================================
     Dependencies
     ========================================================= */
  // Central editor state (single source of truth)
  readonly editorState: EditorStateService;

  constructor(editorState: EditorStateService) {
    this.editorState = editorState;
  }

  /* =========================================================
     Tool selection
     ========================================================= */
  // Available editor tools (segmented control)
  readonly tools: { id: EditorToolId; label: string }[] = [
    { id: 'mouse', label: 'Souris' },
    { id: 'applicator', label: 'Applicateur' },
  ];

  /* =========================================================
     Mode & size options
     ========================================================= */
  // Game mode selection (mutually exclusive)
  readonly modeOptions = [
    { value: GameMode.CLASSIC, label: 'Classic' },
    { value: GameMode.CTF, label: 'CTF' },
  ] as const;

  // Map size selection
  readonly sizeOptions = [
    { value: MapSize.S, label: '10×10' },
    { value: MapSize.M, label: '15×15' },
    { value: MapSize.L, label: '20×20' },
  ] as const;

  readonly hasAttemptedSave = signal(false);
  readonly validationResult = computed(() => validateGame(this.editorState.editorMap()));

  /* =========================================================
     Actions
     ========================================================= */

  /**
   * Reset the entire map to its initial state.
   * Intended for quick iteration during editing.
   */
  onReset(): void {
    this.editorState.resetMap();
  }

  /**
   * Cancel current selection (tool / tile / object).
   * Does NOT revert map content.
   */
  onCancel(): void {
    this.editorState.clearSelection();
  }

  /**
   * Save action.
   */
  onSave(): void {
    this.hasAttemptedSave.set(true);
    const result = this.validationResult();

    if (!result.isValid) return;

    // TODO: wire up save action once persistence is implemented.
  }

  /* =========================================================
     Editor configuration
     ========================================================= */

  /**
   * Update game mode.
   * Centralized in EditorStateService to enforce
   * mode-specific constraints (ex. CTF rules).
   */
  setMode(mode: GameMode): void {
    this.editorState.setMode(mode);
  }

  /**
   * Update map size.
   * EditorStateService is responsible for resizing
   * the grid and handling data migration if needed.
   */
  setSize(size: MapSize): void {
    this.editorState.setSize(size);
  }
}
