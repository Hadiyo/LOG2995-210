import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { ObjectPaletteItem, TilePaletteItem } from './editor-sidebar.types';

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

  /* =========================================================
     Tile palette configuration
     - Maps TileType enum → labels + theme color variables
     - Door uses a single enum value (TileType.DOOR):
       toggling open/closed handled by editor logic
     ========================================================= */
  protected readonly tiles: TilePaletteItem[] = [
    { id: TileType.WALL, label: 'Mur', description: 'Tuile non traversable.', cssVar: '--tile-wall-img' },
    {
      id: TileType.DOOR,
      label: 'Porte',
      description: 'Une porte doit se situer entre 2 murs. Elle peut être ouverte ou fermée.',
      cssVar: '--tile-door-closed-img',
    },
    { id: TileType.WATER, label: 'Eau', description: 'Tuile traversable qui prend deux points de mouvement.', cssVar: '--tile-water-img' },
    { id: TileType.ICE, label: 'Glace', description: 'Tuile traversable qui prend aucun point de mouvement.', cssVar: '--tile-ice-img' },
  ];

  /* =========================================================
     Object palette configuration
     - Maps ObjectType enum → labels + theme color variables
     ========================================================= */
  protected readonly objects: ObjectPaletteItem[] = [
    {
      id: ObjectType.START,
      label: 'Point de départ',
      description: "Un joueur est assigné aléatoirement un point de départ au début d'une partie.",
      cssVar: '--object-spawn-img',
    },
    {
      id: ObjectType.FLAG,
      label: 'Drapeau',
      description: "L'objectif principal du mode CTF.",
      cssVar: '--object-flag-img',
    },
  ];

  constructor(editorState: EditorStateService) {
    this.editorState = editorState;
  }
}
