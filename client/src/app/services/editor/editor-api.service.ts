import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EditorMap } from '@common/interface';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class EditorApiService {
    constructor(private readonly http: HttpClient) {}

    private readonly serverUrl: string = environment.serverUrl;

    /**
     * Fetches the EditorMap from the server with its id and returns an observable.
     * Map fetching errors are handled by the editor-state.
     * @param mapId 
     * @returns EditorMap interface
     */
    async getEditorMap(mapId: string): Promise<EditorMap> {
        return firstValueFrom(this.http.get<EditorMap>(`${this.serverUrl}/editor/${mapId}`));
    }

}