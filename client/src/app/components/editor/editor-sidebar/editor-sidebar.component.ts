import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { OBJECTS, TILES } from '@app/shared/tooltip/tooltip.constants';
import { GameMode, ObjectType } from '@common/maps/map.enums';

@Component({
  selector: 'app-editor-sidebar',

  /**
   * Standalone component imports:
   * - CommonModule: *ngIf, ngClass, etc. 
   * - FormsModule: ngModel bindings used in the template inputs
   * - MatTooltipModule: tooltips for the buttons
   */
  imports: [CommonModule, FormsModule, MatTooltipModule],

  templateUrl: './editor-sidebar.component.html',
  styleUrls: ['./editor-sidebar.component.scss'],
})
export class EditorSidebarComponent {
  /* =========================================================
     Template helpers
     - Expose enums so HTML can compare modes/types safely
     ========================================================= */
  readonly gameMode = GameMode;
  readonly objectType = ObjectType;

  /* =========================================================
     Form constraints (used for maxlength + counters)
     ========================================================= */
  readonly nameMax = 25;
  readonly descMax = 120;

  /* =========================================================
     Dependency
     - readonly in constructor auto-creates a property
     - used directly in the template (editorState.xxx)
     ========================================================= */
  readonly editorState: EditorStateService;

  constructor(editorState: EditorStateService) {
    this.editorState = editorState;
  }

  /* =========================================================
     Palette data
     - Expose constants for template rendering
     ========================================================= */
  protected tiles = TILES;
  protected objects = OBJECTS;

  protected isDisabled(objectId: ObjectType) : boolean {
   return this.editorState.getObjectCountAndLimit(objectId).count 
      === this.editorState.getObjectCountAndLimit(objectId).limit;
  } 
}
