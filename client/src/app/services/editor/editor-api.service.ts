import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EditorMap } from '@common/interface';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class EditorApiService {
    constructor(private readonly http: HttpClient) {}

    private readonly serverUrl: string = environment.serverUrl;
    private map = new Subject<EditorMap>();

    readonly editorMap$ = this.map.asObservable();

    getEditorMap(mapId: number): void {
        this.http.get<EditorMap>(`${this.serverUrl}/{gateway-name}/${mapId}`);
    }

}