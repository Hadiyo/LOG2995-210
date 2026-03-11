import { Injectable } from '@angular/core';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { PlayerInformation } from '@common/player/player.interface';
import { WaitingRoomEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WaitingRoomService {
  private playersSubjects = new BehaviorSubject<PlayerInformation[]>([]);
  players$ = this.playersSubjects.asObservable();

  constructor(private socket: SocketManagerService) {}

  initWaitingRoom(): void {
    if (!this.socket.isSocketAlive())
      this.socket.connect();

    this.subscribeToSocketEvents();
  }

  unsubscribeSocketEvents(): void {
    this.socket.off<PlayerInformation>(WaitingRoomEvents.PlayerJoinedSession, this.onJoinedPlayer);
    this.socket.off<PlayerInformation>(WaitingRoomEvents.PlayerLeftSession, this.onPlayerLeft);
    this.socket.off<PlayerInformation[]>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.off<void>(WaitingRoomEvents.GameSessionDeleted, this.onDeletedSession);
    this.playersSubjects.next([]);
  }

  private subscribeToSocketEvents(): void {
    this.socket.on<PlayerInformation>(WaitingRoomEvents.PlayerJoinedSession, this.onJoinedPlayer);
    this.socket.on<PlayerInformation>(WaitingRoomEvents.PlayerLeftSession, this.onPlayerLeft);
    this.socket.on<PlayerInformation[]>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.on<void>(WaitingRoomEvents.GameSessionDeleted, this.onDeletedSession);
  }

  /** REQUESTS */
  /**
   * The organizer is allowed to delete the game session he was responsible to create
   * @param sessionId 
   */
  deleteGameSession(sessionId: string): void {
    this.socket.send(WaitingRoomEvents.DeleteGameSession, sessionId);
  }

  /**
   * Client request to leave a game session
   * @param sessionId 
   */
  leaveGameSession(playerName: string): void {
    this.socket.send(WaitingRoomEvents.LeaveGameRoom, playerName);
  }

  /** HANDLERS */

  private onClientJoinedSession = (players: PlayerInformation[]) => {
    this.playersSubjects.next(players);
  };

  /**
   * Adds the playerInformation from the behavioural subject
   * Event: WaitingRoomEvents.PlayerJoinedSession
   * @param player 
   */
  private onJoinedPlayer = (player: PlayerInformation) => {
    this.playersSubjects.next([...this.playersSubjects.value, player]);
  };

  /**
   * Removes the playerInformation from the behavioural subject
   * @param player 
   */
  private onPlayerLeft = (player: PlayerInformation) => {
    const updatedPlayers = this.playersSubjects.value.filter(
      participant => participant.name !== player.name,
    );
    this.playersSubjects.next(updatedPlayers);
  };

  private onDeletedSession = () => {
    // SIGNAL PLAYER THAT SESSION WAS CANCELED
    // GO TO MAIN PAGE
  };
  
}
