import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ObjectType, TileType } from '@common/enum';

/*
 * EditorTool Component
 * Tool component for the tools on the editor toolbar.
*/

@Component({
  selector: 'app-editor-tools',
  imports: [],
  templateUrl: './editor-tools.component.html',
  styleUrl: './editor-tools.component.scss',
})
export class EditorToolsComponent {
  @Input() tool: TileType | ObjectType;

  @Output() clicked = new EventEmitter<TileType | ObjectType>();

  onClick() {
    this.clicked.emit(this.tool);
  }
}
