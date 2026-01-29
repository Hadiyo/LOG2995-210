import { inject, Injectable } from '@angular/core';
import { MapConfig } from '@app/interfaces/create-map-dialog';
import { EditorStateService } from './editor/editor-state.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
    private editorStateService = inject(EditorStateService);

    /**
     * Calls the editor to set the initial map with the given parameters
     * in the editor view
     * @param result interface containing the map size and mode
     */
    setMapProperties(result: MapConfig): void {
        this.editorStateService.setMapModeSize(result);
    }

    /**
     * Calls the editor state to fetch the map defined by the mapId
     * for the editor view
     * @param mapId map identification number
     */
    fetchExistingMapForEditor(mapId: string): void {
        this.editorStateService.loadExistingEditorMap(mapId);
    }
}
