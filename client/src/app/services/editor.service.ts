import { Injectable, WritableSignal, signal } from '@angular/core';
import { ObjectType, TileType } from '@common/enum';

/*
 * EditorService
 * Service for the editor functionality.
*/

@Injectable({
  providedIn: 'root',
})
export class EditorService {
  activeTool: WritableSignal<TileType | ObjectType | null> = signal(null);
}
