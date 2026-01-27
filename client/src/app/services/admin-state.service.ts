import { inject, Injectable } from '@angular/core';
import { MapConfig } from '@app/interfaces/create-game-dialog';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class AdminStateService {
    private editorStateService = inject(EditorStateService);

    setMapProperties(result: MapConfig): void {
        this.editorStateService.generateMap(result);
    }
}
