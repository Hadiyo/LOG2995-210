import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PopUpComponent } from '@app/components/editor/pop-up/pop-up.component';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { GameMode, MapSize } from '@common/enum';
import { validateGame, type GameValidationIssue, type GameValidationResult } from '@common/game-validation';
import { GameService } from 'src/app/services/game.service';

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
  private readonly badRequestStatus = 400;
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
  readonly router: Router;
  readonly overlay: Overlay;
  readonly gameService: GameService;

  constructor(editorState: EditorStateService, router: Router, overlay: Overlay, gameService: GameService) {
    this.editorState = editorState;
    this.router = router;
    this.overlay = overlay;
    this.gameService = gameService;
  }

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
  readonly serverIssues = signal<GameValidationIssue[]>([]);
  readonly localValidation = computed(() => validateGame(this.editorState.editorMap()));
  readonly activeIssues = computed(() => {
    const localValidation = this.localValidation();
    if (!localValidation.isValid) return localValidation.issues;
    return this.serverIssues();
  });
  readonly shouldShowIssues = computed(() => this.hasAttemptedSave() && this.activeIssues().length > 0);

  /* =========================================================
     Actions
     ========================================================= */

  /**
   * Return to admin view without saving.
   */
  onBack(): void {
    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
    });

    const portal = new ComponentPortal(PopUpComponent);
    const ref = overlayRef.attach(portal);

    ref.instance.closePopUp.subscribe(() => overlayRef.dispose());
    overlayRef.backdropClick().subscribe(() => overlayRef.dispose());
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
  async onSave(): Promise<void> {
    this.hasAttemptedSave.set(true);
    this.serverIssues.set([]);

    const localValidation = this.localValidation();
    if (!localValidation.isValid) return;

    try {
      const savedGame = await firstValueFrom(this.gameService.saveGame(this.editorState.editorMap()));
      this.editorState.loadGame(savedGame);
      await this.router.navigate(['/admin']);
    } catch (error) {
      this.applySaveErrorFeedback(error);
    }
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

  private applySaveErrorFeedback(error: unknown): void {
    const validation = this.extractValidationResult(error);
    if (validation) {
      this.serverIssues.set(validation.issues);
      return;
    }

    window.alert('Echec de la sauvegarde.');
  }

  private extractValidationResult(error: unknown): GameValidationResult | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    if (error.status !== this.badRequestStatus) return null;

    const payload = error.error as GameValidationResult;
    if (!payload || !Array.isArray(payload.issues)) return null;

    return payload;
  }
}
