import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { EditorMap } from '@common/interface';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class MapApiService {
    // API root used by all map-related UI flows (admin list, editor save/load, join flow).
    private readonly baseUrl = `${environment.serverUrl}/maps`;

    constructor(private readonly http: HttpClient) {}

    // Admin/manage UI: fetch all maps (including hidden) to list and manage visibility.
    getAllMaps(): Observable<EditorMap[]> {
        return this.http.get<EditorMap[]>(`${this.baseUrl}/`);
    }

    // Player/join UI: fetch only visible maps to show in the public list.
    getVisibleMaps(): Observable<EditorMap[]> {
        return this.http.get<EditorMap[]>(`${this.baseUrl}/visible`);
    }

    // Editor/join UI: load a specific map by id when opening an existing map.
    getMapById(id: string): Observable<EditorMap> {
        return this.http.get<EditorMap>(`${this.baseUrl}/${id}`);
    }

    // Editor UI: save current map; decides between create and update by id.
    saveMap(map: EditorMap): Observable<EditorMap> {
        return this.isExistingMap(map) ? this.updateMap(map) : this.createMap(map);
    }

    // Admin UI: toggle map visibility without editing the full map.
    updateMapVisibility(id: string, isVisible: boolean): Observable<void> {
        return this.http.patch<void>(`${this.baseUrl}/${id}/visibility`, { visibility: isVisible });
    }

    // Admin UI: delete a map from the list.
    deleteMap(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    // Internal: create a brand-new map from the editor.
    private createMap(map: EditorMap): Observable<EditorMap> {
        return this.http.post<EditorMap>(`${this.baseUrl}/`, map);
    }

    // Internal: update an existing map (id already set).
    private updateMap(map: EditorMap): Observable<EditorMap> {
        return this.http.put<EditorMap>(`${this.baseUrl}/${map.id}`, map);
    }

    // Internal: treats non-empty id as persisted.
    private isExistingMap(map: EditorMap): boolean {
        return map.id.trim().length > 0;
    }
}
