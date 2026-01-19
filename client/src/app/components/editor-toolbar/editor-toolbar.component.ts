import { Component, inject } from '@angular/core';
import { EditorService } from '@app/services/editor.service';
import { ObjectType, TileType } from '@common/enum';
import { EditorToolsComponent } from '../editor-tools/editor-tools.component';

/*
 * EditorToolbarComponent
 * Toolbar component for the editor interface.
*/

@Component({
  selector: 'app-editor-toolbar',
  imports: [EditorToolsComponent],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  private editorService = inject(EditorService);

  tileTypes = Object.values(TileType);
  objectTypes = Object.values(ObjectType);

  // Handles the event emmited when a tool is clicked
  clickTool(tool: TileType | ObjectType): void {
    if (this.editorService.activeTool() === tool) {
      this.editorService.activeTool.set(null);
      return;
    };
    this.editorService.activeTool.set(tool);
  }
}
