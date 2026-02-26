import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EditorStateService } from './editor/editor-state.service';
import { MapConfig } from '@app/config/map.config';

@Injectable({ providedIn: 'root' })
export class AdminService {
    private editorStateService = inject(EditorStateService);

    /**
     * Calls the editor to set the initial map with the given parameters
     * in the editor view
     * @param result interface containing the map size and mode
     */
    setMapProperties(result: MapConfig): boolean {
        return this.editorStateService.setMapModeSize(result);
    }

    /**
     * Calls the editor state to fetch the map defined by the mapId
     * for the editor view
     * @param mapId map identification number
     */
    fetchExistingMapForEditor(mapId: string): Observable<boolean> {
        return this.editorStateService.loadExistingEditorMap(mapId);
    }
}