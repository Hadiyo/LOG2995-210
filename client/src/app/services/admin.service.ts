import { inject, Injectable } from '@angular/core';
import { MapConfig } from '@app/interfaces/create-game-dialog';
import { EditorApiService } from './editor-api.service';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
    private editorStateService = inject(EditorStateService);
    private editorApiService = inject(EditorApiService);

    /**
     * Calls the editor to set the initial map with the given parameters
     * in the editor view
     * @param result interface containing the map size and mode
     */
    setMapProperties(result: MapConfig): void {
        this.editorStateService.generateMap(result);
    }

    /**
     * Calls the editor API to fetch the map defined by the mapId
     * for the editor view
     * @param mapId map identification number
     */
    fetchExistingMapForEditor(mapId: number): void {
        this.editorApiService.getEditorMap(mapId);
    }
}
