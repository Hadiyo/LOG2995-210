import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { EditorMap } from '@common/interface';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class GameService {
    private readonly baseUrl = `${environment.serverUrl}/games`;

    constructor(private readonly http: HttpClient) {}

    getAllGames(): Observable<EditorMap[]> {
        return this.http.get<EditorMap[]>(`${this.baseUrl}/`);
    }

    getVisibleGames(): Observable<EditorMap[]> {
        return this.http.get<EditorMap[]>(`${this.baseUrl}/visible`);
    }

    getGameById(id: string): Observable<EditorMap> {
        return this.http.get<EditorMap>(`${this.baseUrl}/${id}`);
    }

    saveGame(game: EditorMap): Observable<EditorMap> {
        return this.isExistingGame(game) ? this.updateGame(game) : this.createGame(game);
    }

    updateGameVisibility(id: string, isVisible: boolean): Observable<EditorMap> {
        return this.http.patch<EditorMap>(`${this.baseUrl}/${id}/visibility`, { visibility: isVisible });
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    private createGame(game: EditorMap): Observable<EditorMap> {
        return this.http.post<EditorMap>(`${this.baseUrl}/`, game);
    }

    private updateGame(game: EditorMap): Observable<EditorMap> {
        return this.http.put<EditorMap>(`${this.baseUrl}/${game.id}`, game);
    }

    private isExistingGame(game: EditorMap): boolean {
        return game.id.trim().length > 0;
    }
}
