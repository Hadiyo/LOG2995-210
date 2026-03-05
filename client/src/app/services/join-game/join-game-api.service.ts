import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class JoinGameApiService {
  private readonly joinGameUrl = `${environment.serverUrl}/game-map`;

  constructor(private readonly http: HttpClient) {}

  fetchGameSessionCards(): Observable<GameSessionPreview[]> {
    return this.http.get<GameSessionPreview[]>(`${this.joinGameUrl}/`);
  }
}
