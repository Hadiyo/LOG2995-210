import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MapStateService } from '@app/services/map/map-state.service';

import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { PopUpComponent } from '@app/components/editor/pop-up/pop-up.component';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { MapThumbnailService } from '@app/services/map/map-thumbnail.service';
import { validateMap, type MapValidationIssue, type MapValidationResult } from '@common/maps/map-validation';
import { GameMode, MapSize } from '@common/maps/map.enums';

import { MouseButton } from '@common/mouse-events.enum';
import { take } from 'rxjs';


@Component({
  selector: 'app-editor-topbar',

  /**
   * Standalone component imports:
   * - CommonModule: structural directives and common Angular features
   */
  imports: [CommonModule, BackButtonComponent],

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
  constructor(
    private readonly editorState: EditorStateService,
    private readonly router: Router,
    private readonly overlay: Overlay,
    private readonly mapThumbnail: MapThumbnailService, // Map preview generation
    private readonly mapStateService: MapStateService,
  ) {}

  /* =========================================================
     Hotkey UI
     ========================================================= */
  readonly isRightClicking = computed(() => this.editorState.activeButton() === MouseButton.Right);

  readonly isShiftPressed = computed(() => this.editorState.isShiftPressed());

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
  readonly serverIssues = signal<MapValidationIssue[]>([]);
  readonly localValidation = computed(() => validateMap(this.editorState.editorMap()));
  readonly activeIssues = computed(() => {
    const localValidation = this.localValidation();
    if (!localValidation.isValid) return localValidation.issues;
    return this.serverIssues();
  });
  readonly shouldShowIssues = computed(() => this.hasAttemptedSave() && this.activeIssues().length > 0);
  readonly isSaveActionValid = computed(() => this.localValidation().isValid && this.serverIssues().length === 0);

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

    ref.instance.closePopUp.pipe(take(1)).subscribe(() => overlayRef.dispose());
    overlayRef.backdropClick().pipe(take(1)).subscribe(() => overlayRef.dispose());
    ref.instance.confirmPopUp.pipe(take(1)).subscribe(() => {
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
      // Generate preview image for the current map state
      const currentMap = this.editorState.editorMap();
      const preview = await this.mapThumbnail.generatePreview(currentMap);
      // Save the map along with its preview image
      const mapWithPreview = {
        ...currentMap,
        visibility: false,
        previewImage: preview?.data ?? undefined,
        previewImageFormat: preview?.format ?? undefined,
      };
      await this.mapStateService.createMap(mapWithPreview);
      await this.router.navigate(['/admin']);
    } catch (error) {
      this.applySaveErrorFeedback(error);
    }
  }

  /* =========================================================
     Editor configuration
     ========================================================= */

  private applySaveErrorFeedback(error: unknown): void {
    const validation = this.extractValidationResult(error);
    if (validation) {
      this.serverIssues.set(validation.issues);
      return;
    }

    window.alert('Echec de la sauvegarde.');
  }

  private extractValidationResult(error: unknown): MapValidationResult | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    if (error.status !== HttpStatusCode.BadRequest) return null;

    const payload = error.error as MapValidationResult;
    if (!payload || !Array.isArray(payload.issues)) return null;

    return payload;
  }
}
