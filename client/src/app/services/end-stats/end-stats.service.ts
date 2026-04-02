import { Injectable } from '@angular/core';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { EndStats } from '@common/game-session';
import { SessionSocketEvents } from '@common/socket-events';

@Injectable({
  providedIn: 'root',
})
export class EndStatsService {
  private _endStats: EndStats;
  
  constructor(
    private readonly socket: SocketManagerService,
  ) {}

  get endStats(): EndStats {
    return this._endStats;
  }

  initEndStats() {
    if (!this.socket.isSocketAlive()) {
      this.socket.connect();
    }

    this.subscribeToSocketEvents();
  }

  subscribeToSocketEvents() {
    this.socket.on(SessionSocketEvents.EndGame, this.onEndGame);
  }

  unsubscribeToSocketEvents() {
    this.socket.off(SessionSocketEvents.EndGame, this.onEndGame);
  }

  onEndGame = (payload: EndStats): void => {
    this._endStats = payload;
  };
}
