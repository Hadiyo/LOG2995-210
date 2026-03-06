import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { CreateSessionPayload, GameSessionPreview } from '@common/game/game-session.interface';
import { PageContext, PageSocketEvents, RoomSocketEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';
import { SessionApiService } from './session-api.service';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private sessionPreviewSubjects = new BehaviorSubject<GameSessionPreview[]>([]);
  sessionsPreview$ = this.sessionPreviewSubjects.asObservable();

  readonly state = signal<ServiceState>(ServiceState.Idle);

  private api = inject(SessionApiService);

  constructor(private socket: SocketManagerService, private router: Router) {}

  initGameSessionService(): void {
    if (!this.socket.isSocketAlive())
      this.socket.connect();
    this.loadGameSessions();
    this.subscribeToSessionEvents();
  }

  /**
   * Fetch all sessionPreviews with their information to be displayed
   * in join game page
   */
  loadGameSessions(): void {
    this.api.fetchGameSessions().subscribe({
      next: sessions => {
        this.sessionPreviewSubjects.next(sessions);
        this.state.set(ServiceState.Loaded);
      },
      error: () => this.state.set(ServiceState.Error),
    });
  }

  /**
   * Create a game session and redirect the user to the waiting room
   * corresponding to its sessionId. Requires the client socket id
   * @param payload 
   */
  createGameSession(payload: CreateSessionPayload): void {
    this.socket.send(RoomSocketEvents.CreateGameSession, payload);
  }

  /**
   * Requests the server to delete the game session
   * @param sessionId 
   */
  deleteGameSession(sessionId: string): void {
    this.socket.send(RoomSocketEvents.DeleteGameSession, sessionId);
  }

  /**
   * Client request to join a game session
   * @param sessionId 
   */
  joinGameSession(sessionId: string): void {
    this.socket.send(RoomSocketEvents.JoinGameRoom, sessionId);
  }

  /**
   * Client request to leave a game session
   * @param sessionId 
   */
  leaveGameSession(sessionId: string): void {
    this.socket.send(RoomSocketEvents.LeaveGameRoom, sessionId);
  }

  /**
   * Subscribes to all real-time socket events related to JoinPage
   */
  subscribeToSessionEvents() {
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
    this.socket.send(PageSocketEvents.JoinPage, { page: PageContext.JoinGame });
    this.socket.on<string>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
    this.socket.on<string>(RoomSocketEvents.IncrementPlayerCount, this.onJoinedPlayer);
    this.socket.on<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.on<string>(RoomSocketEvents.GameSessionDeleted, this.onDeleteSession);
  }

  /**
  * Unsubscribes to all real-time socket events related to JoinPage
  */
  unsubscribeToSessionEvents() {
    this.socket.send(PageSocketEvents.LeavePage, { page: PageContext.JoinGame });
    this.socket.off<string>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
    this.socket.off<string>(RoomSocketEvents.IncrementPlayerCount, this.onJoinedPlayer);
    this.socket.off<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.off<string>(RoomSocketEvents.GameSessionDeleted, this.onDeleteSession);
  }

  /**
   * Navigate the user to the waiting room using the new sessionId
   * @param sessionId 
   */
  private onSessionCreated = (sessionId: string) => {
    // CALL CHAT INIT METHOD HERE
    this.router.navigate(['waiting-room', sessionId]);
  };

  /**
   * Increments the number of players in the list of available game sessions
   * by its sessionId
   * @param sessionId 
   */
  private onJoinedPlayer = (sessionId: string) => {
    const updated = this.sessionPreviewSubjects.value.map(session =>
      session.id === sessionId
        ? { ...session, playerCount: session.nbOfPlayers + 1 }
        : session,
    );
    this.sessionPreviewSubjects.next(updated);
  };

  /**
   * Decrements the number of players in the given session
   * @param sessionId 
   */
  private onPlayerLeft = (sessionId: string) => {
    const updated = this.sessionPreviewSubjects.value.map(session =>
      session.id === sessionId
        ? { ...session, playerCount: session.nbOfPlayers - 1 }
        : session,
    );
    this.sessionPreviewSubjects.next(updated);
  };

  /**
   * Deletes the local copy of the given session
   * @param sessionId 
   */
  private onDeleteSession = (sessionId: string) => {
    const updated = this.sessionPreviewSubjects.value.filter(
      s => s.id !== sessionId,
    );
    this.sessionPreviewSubjects.next(updated);
  };
}
