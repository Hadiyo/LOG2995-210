import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EditorMap } from '@common/interface';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class EditorApiService {
    private readonly serverUrl: string = environment.serverUrl;
    constructor(private readonly http: HttpClient) {}

    async getEditorMap(): Promise<Observable<EditorMap>> {
        // Logic to fetch an exisiting map through the server
        return this.http.get<EditorMap>(`${this.serverUrl}/{gateway-name}`).pipe(catchError(this.handleError<EditorMap>('basicGet')));
    }

    private handleError<T>(request: string, result?: T): (error: Error) => Observable<T> {
        return () => of(result as T);
    }

}