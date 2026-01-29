import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PopUpComponent } from '@app/components/editor/pop-up/pop-up.component';

import { EditorStateService } from '@app/services/editor/editor-state.service';
import { GameMode, MapSize, MouseButton } from '@common/enum';
import { validateGame } from '@common/game-validation';

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

  // Router for redirection 
  readonly router: Router;

  // Overlay service for pop-up
  readonly overlay: Overlay;

  constructor(editorState: EditorStateService, router: Router, overlay: Overlay) {
    this.editorState = editorState;
    this.router = router;
    this.overlay = overlay;
  }

  /* =========================================================
     Hotkey UI
     ========================================================= */
  readonly isRightClicking = computed(() => this.editorState.activeButton() === MouseButton.Right);

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
   * Return to admin view without saving
   */
  onBack(): void {
    // Styling for pop-up overlay
    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
    });

    // Portal in the pop-up component
    const portal = new ComponentPortal(PopUpComponent);
    const ref = overlayRef.attach(portal);

    // On close: close overlay
    ref.instance.closePopUp.subscribe(() => overlayRef.dispose());

    // On backdrop click: close overlay
    overlayRef.backdropClick().subscribe(() => overlayRef.dispose());

    // On confirm: close overlay and navigate back to admin
    ref.instance.confirmPopUp.subscribe(() => {
      overlayRef.dispose();
      this.router.navigate(['/admin']);
    });
  }

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
    // Redirection towards admin view if valid save
    this.router.navigate(['/admin']);
  }
}
