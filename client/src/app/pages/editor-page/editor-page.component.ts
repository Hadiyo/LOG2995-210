import { Component } from '@angular/core';
import { EditorSidebarComponent } from 'src/app/components/editor/editor-sidebar/editor-sidebar.component';
import { EditorTopbarComponent } from 'src/app/components/editor/editor-topbar/editor-topbar.component';
import { EditorCanvasComponent } from 'src/app/components/editor/editor-canvas/editor-canvas.component';

@Component({
  selector: 'app-editor-page',

  /**
   * Standalone component:
   * Import the 3 editor sub-components directly.
   */
  imports: [EditorSidebarComponent, EditorTopbarComponent, EditorCanvasComponent],

  templateUrl: './editor-page.component.html',

  // Note: in standalone Angular, it's "styleUrl" (singular) if you only have one file
  styleUrl: './editor-page.component.scss',
})
export class EditorPageComponent {
  /**
   * Page shell component.
   * All editor logic is handled by EditorStateService inside sub-components.
   */
}
