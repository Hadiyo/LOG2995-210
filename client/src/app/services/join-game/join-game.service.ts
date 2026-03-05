import { Injectable } from '@angular/core';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { BehaviorSubject } from 'rxjs';
import { JoinGameApiService } from './join-game-api.service';

@Injectable({
  providedIn: 'root',
})
export class JoinGameService {
  private playerSubject = new BehaviorSubject<GameSessionPreview[]>([]);
  players$ = this.playerSubject.asObservable();

  constructor(private socket: SocketManagerService, private api: JoinGameApiService) {}

  initJoinGameService(): void {
    // Connect to socket
    if (!this.socket.isSocketAlive())
      this.socket.connect();
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
    // Initiate gameSessionPreview
    this.api.fetchGameSessionCards();
  }

  createGameSession(): void {
    return;
  }

  joinGameSession(): void {
    return;
  }

  leaveGameSession(): void {
    return;
  }

}
