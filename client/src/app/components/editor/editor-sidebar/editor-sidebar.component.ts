import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OBJECTS, TILES } from '@app/shared/tooltip/tooltip.constants';
import { EditorStateService } from '@app/services/editor/editor-state.service';
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
     - used directly in the template (editorState.xxx)
     ========================================================= */
  readonly editorState: EditorStateService;

  protected readonly tiles = TILES;
  protected readonly objects = OBJECTS;

  constructor(editorState: EditorStateService) {
    this.editorState = editorState;
  }

  protected isDisabled(objectId: ObjectType): boolean {
    const { count, limit } = this.editorState.getObjectCountAndLimit(objectId);
    return limit === 0 || count === limit;
  }
}
