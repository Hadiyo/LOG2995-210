import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameMode, ObjectType, TileType } from '@common/enum';
import { EditorStateService } from 'src/app/services/editor-state.service';

/**
 * Simple UI types for palette rendering
 * - Keeps template clean and strongly typed
 */
type TilePaletteItem = { id: TileType; label: string; description: string; cssVar: string };
type ObjectPaletteItem = { id: ObjectType; label: string; description: string; cssVar: string };

@Component({
  selector: 'app-editor-sidebar',
  standalone: true,

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
  constructor(readonly editorState: EditorStateService) {}

  /* =========================================================
     Tile palette configuration
     - Maps TileType enum → labels + theme color variables
     - Door uses a single enum value (TileType.DOOR):
       toggling open/closed handled by editor logic
     ========================================================= */
  tiles: TilePaletteItem[] = [
    { id: TileType.WALL, label: 'Mur', description: "Tuile non traversable.", cssVar: '--tile-wall' },
    { id: TileType.DOOR, label: 'Porte (toggle)', description: "Une porte doit se situer entre 2 murs. Elle peut être ouverte ou fermée.", cssVar: '--tile-door-closed' },
    { id: TileType.WATER, label: 'Eau', description: "Tuile traversable qui prend deux points de mouvement.", cssVar: '--tile-water' },
    { id: TileType.ICE, label: 'Glace', description: "Tuile traversable qui prend aucun point de mouvement.", cssVar: '--tile-ice' },

    // Optional: allows painting a normal floor tile explicitly
    { id: TileType.DIRT, label: 'Sol', description: "Tuile de base", cssVar: '--bg-panel-soft' }
  ];

  /* =========================================================
     Object palette configuration
     - Maps ObjectType enum → labels + theme color variables
     ========================================================= */
  objects: ObjectPaletteItem[] = [
    { id: ObjectType.START, label: 'Point de départ', description: "Un joueur est assigné aléatoirement un point de départ au début d'une partie.", cssVar: '--object-spawn', },
    { id: ObjectType.FLAG, label: 'Drapeau', description: "L'objectif principal de mode CTF.", cssVar: '--object-flag', },
    {
      id: ObjectType.REGEN, label: 'Sanctuaire de soin',
      description: `Activer pour regagner 2 points de vie au joueur.`,
      cssVar: '--object-heal',
    },
    {
      id: ObjectType.ARENA, label: 'Sanctuaire de combat',
      description: `Activer pour un bonus temporaire de +1 à l'attaque et à la défense. Ce bonus reste jusqu'à la fin de son prochain tour.`,
      cssVar: '--object-fight'
    },
  ];
}
