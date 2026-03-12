import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { PlayerPayload } from '@common/game/game-session.interface';
import { PlayerInformation } from '@common/player/player.interface';
import { WaitingRoomEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WaitingRoomService {
  /** The current client's own player information */
  me?: PlayerInformation;

  private playersSubjects = new BehaviorSubject<PlayerInformation[]>([]);
  players$ = this.playersSubjects.asObservable();

  constructor(private socket: SocketManagerService, private router: Router) {}

  initWaitingRoom(): void {
    if (!this.socket.isSocketAlive())
      this.socket.connect();

    this.subscribeToSocketEvents();
  }

  unsubscribeSocketEvents(): void {
    this.socket.off<PlayerInformation>(WaitingRoomEvents.PlayerJoinedSession, this.onJoinedPlayer);
    this.socket.off<PlayerInformation>(WaitingRoomEvents.PlayerLeftSession, this.onPlayerLeft);
    this.socket.off<PlayerPayload>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.off<void>(WaitingRoomEvents.GameSessionDeleted, this.onDeletedSession);
    this.socket.off<void>(WaitingRoomEvents.KickedFromSession, this.onKickedFromSession);
    this.playersSubjects.next([]);
    this.me = undefined;
  }

  private subscribeToSocketEvents(): void {
    this.socket.on<PlayerInformation>(WaitingRoomEvents.PlayerJoinedSession, this.onJoinedPlayer);
    this.socket.on<PlayerInformation>(WaitingRoomEvents.PlayerLeftSession, this.onPlayerLeft);
    this.socket.on<PlayerPayload>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.on<void>(WaitingRoomEvents.GameSessionDeleted, this.onDeletedSession);
    this.socket.on<void>(WaitingRoomEvents.KickedFromSession, this.onKickedFromSession);
  }

  /** REQUESTS */

  /**
   * The organizer deletes the entire game session.
   * The server identifies the session from the organizer's socket room.
   */
  deleteGameSession(): void {
    this.socket.send(WaitingRoomEvents.DeleteGameSession);
  }

  /**
   * The current client leaves their game session.
   * The server identifies the player from the socket connection.
   */
  leaveGameSession(): void {
    this.socket.send(WaitingRoomEvents.LeaveGameRoom);
  }

  /**
   * The organizer kicks a player by name.
   * @param playerName - name of the player to kick
   */
  kickPlayer(playerName: string): void {
    this.socket.send(WaitingRoomEvents.KickPlayer, playerName);
  }

  /** HANDLERS */

  /**
   * Joiner: receives the full PlayerPayload when joining an existing session.
   * Sets me to clientPlayer and initializes the players list.
   */
  private onClientJoinedSession = (payload: PlayerPayload) => {
    this.me = payload.clientPlayer;
    this.playersSubjects.next(payload.players);
  };

  /**
   * Organizer: receives their own info as the first PlayerJoinedSession.
   * Subsequent calls are for other players joining the room.
   */
  private onJoinedPlayer = (player: PlayerInformation) => {
    if (!this.me) {
      this.me = player;
    }
    this.playersSubjects.next([...this.playersSubjects.value, player]);
  };

  private onPlayerLeft = (player: PlayerInformation) => {
    const updatedPlayers = this.playersSubjects.value.filter(
      participant => participant.name !== player.name,
    );
    this.playersSubjects.next(updatedPlayers);
  };

  /** Session was deleted by organizer — navigate all players back to main page */
  private onDeletedSession = () => {
    this.router.navigate(['']);
  };

  /** Current client was kicked by the organizer */
  private onKickedFromSession = () => {
    this.router.navigate(['']);
  };
}
