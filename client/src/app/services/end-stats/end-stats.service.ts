import { Injectable } from '@angular/core';
import { EndStats } from '@common/game-session';
import { SessionSocketEvents } from '@common/socket-events';
import { SocketManagerService } from '../socket-manager/socket-manager.service';

@Injectable({
  providedIn: 'root',
})
export class EndStatsService {
  endStats: EndStats;
  
  constructor(
    private readonly socket: SocketManagerService,
  ) {}

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
    this.endStats = payload;
    console.log("payload: ", payload);
  }
}
