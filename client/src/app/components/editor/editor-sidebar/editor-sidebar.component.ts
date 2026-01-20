import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStateService } from 'src/app/services/editor-state.service';
import { GameMode, TileType, ObjectType } from '@common/enum';

/**
 * Simple UI types for palette rendering
 * - Keeps template clean and strongly typed
 */
type TilePaletteItem = { id: TileType; label: string; cssVar: string };
type ObjectPaletteItem = { id: ObjectType; label: string; cssVar: string };

@Component({
  selector: 'app-editor-sidebar',
  standalone: true,

  /**
   * Standalone component imports:
   * - CommonModule: *ngIf, ngClass, etc. 
   * - FormsModule: ngModel bindings used in the template inputs
   */
  imports: [CommonModule, FormsModule],

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
  constructor(readonly editorState: EditorStateService) {}

  /* =========================================================
     Tile palette configuration
     - Maps TileType enum → labels + theme color variables
     - Door uses a single enum value (TileType.DOOR):
       toggling open/closed handled by editor logic
     ========================================================= */
  tiles: TilePaletteItem[] = [
    { id: TileType.WALL, label: 'Mur', cssVar: '--tile-wall' },
    { id: TileType.DOOR, label: 'Porte (toggle)', cssVar: '--tile-door-closed' },
    { id: TileType.WATER, label: 'Eau', cssVar: '--tile-water' },
    { id: TileType.ICE, label: 'Glace', cssVar: '--tile-ice' },

    // Optional: allows painting a normal floor tile explicitly
    { id: TileType.DIRT, label: 'Sol', cssVar: '--bg-panel-soft' },
  ];

  /* =========================================================
     Object palette configuration
     - Maps ObjectType enum → labels + theme color variables
     ========================================================= */
  objects: ObjectPaletteItem[] = [
    { id: ObjectType.START, label: 'Point de départ', cssVar: '--object-spawn' },
    { id: ObjectType.FLAG, label: 'Drapeau', cssVar: '--object-flag' },
    { id: ObjectType.REGEN, label: 'Sanctuaire de soin', cssVar: '--object-heal' },
    { id: ObjectType.ARENA, label: 'Sanctuaire de combat', cssVar: '--object-fight' },
  ];
}
