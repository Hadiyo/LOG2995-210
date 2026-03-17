import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceState } from '@app/services/service-state.enum';
import { SessionApiService } from '@app/services/session/session-api.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { GameSessionPreview, JoinSessionPayload, PlayerPayload } from '@common/game/game-session.interface';
import { PlayerInformation } from '@common/player/player.interface';
import { ErrorSocketEvents, PageContext, PageSocketEvents, RoomSocketEvents, WaitingRoomEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';

/**
 * This services allows a client to join and create a game sessions and provides dynamic UI features 
 * (ex. player count in join-game page)
 */

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private sessionPreviewSubjects = new BehaviorSubject<GameSessionPreview[]>([]);
  sessionsPreview$ = this.sessionPreviewSubjects.asObservable();

  private contextSubject = new BehaviorSubject<'create' | 'join' | null>(null);
  context$ = this.contextSubject.asObservable();

  private currentMapId?: string;
  private currentPreviewId?: string;
  private joinedSessionPayload?: PlayerPayload;

  readonly state = signal<ServiceState>(ServiceState.Idle);
  readonly errorMessage = signal('');

  private api = inject(SessionApiService);

  constructor(private socket: SocketManagerService, private readonly router: Router) {}

  getMapId(): string | undefined {
    return this.currentMapId;
  }

  getPreviewId(): string | undefined {
    return this.currentPreviewId;
  }

  setMapId(id: string) {
    this.currentMapId = id;
  }

  setPreviewId(id: string) {
    this.currentPreviewId = id;
  }

  setContext(context: 'create' | 'join') {
    this.contextSubject.next(context);
    this.errorMessage.set('');
  }

  consumeJoinedSessionPayload(): PlayerPayload | undefined {
    const payload = this.joinedSessionPayload;
    this.joinedSessionPayload = undefined;
    return payload;
  }
  /**
   * Initialises the session service by setting socket connection and the GameSessionPreview list 
   */
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
    this.state.set(ServiceState.Loading);
    this.api.fetchGameSessions().subscribe({
      next: sessions => {
        this.sessionPreviewSubjects.next(sessions);
        this.state.set(ServiceState.Loaded);
      },
      error: () => this.state.set(ServiceState.Error),
    });
  }

  /**
 * Subscribes to all real-time socket events related to JoinPage
 */
  subscribeToSessionEvents() {
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
    this.socket.send(PageSocketEvents.JoinPage, { page: PageContext.JoinGame });
    this.socket.on<string>(RoomSocketEvents.IncrementPlayerCount, this.onClientAddedToSession);
    this.socket.on<void>(RoomSocketEvents.PlayerJoinedGame, this.onJoinedSession);
    this.socket.on<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.on<string>(WaitingRoomEvents.GameSessionDeleted, this.onDeleteSession);
    this.socket.on<PlayerPayload>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.on<GameSessionPreview>(RoomSocketEvents.NewAvailableSession, this.onNewAvailableSession);
    this.socket.on<string>(ErrorSocketEvents.FailedJoinSession, this.onFailedJoinSession);
  }

  /**
  * Unsubscribes to all real-time socket events related to JoinPage
  */
  unsubscribeToSessionEvents() {
    this.socket.send(PageSocketEvents.LeavePage, { page: PageContext.JoinGame });
    this.socket.off<string>(RoomSocketEvents.IncrementPlayerCount, this.onClientAddedToSession);
    this.socket.off<void>(RoomSocketEvents.PlayerJoinedGame, this.onJoinedSession);
    this.socket.off<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.off<string>(WaitingRoomEvents.GameSessionDeleted, this.onDeleteSession);
    this.socket.off<PlayerPayload>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.off<GameSessionPreview>(RoomSocketEvents.NewAvailableSession, this.onNewAvailableSession);
    this.socket.off<string>(ErrorSocketEvents.FailedJoinSession, this.onFailedJoinSession);
  }

  /** REQUESTS */

  /**
   * Create a game session and redirect the user to the waiting room
   * corresponding to its sessionId. Requires the client socket id
   * @param payload 
   */
  createGameSession(character: PlayerInformation): void {
    this.errorMessage.set('');
    const payload: JoinSessionPayload = {
      id: this.currentMapId,
      character,
    };
    this.socket.send(RoomSocketEvents.CreateGameSession, payload);
    this.clearCurrentIds();
  }

  joinSession(previewId: string): void {
    this.socket.send(RoomSocketEvents.JoinGameRoom, previewId);
  }

  leaveSession(): void {
    this.socket.send(RoomSocketEvents.LeaveSession, this.currentPreviewId);
  }

  /**
   * Client request to join a game session
   * @param sessionId 
   */
  addPlayerToSession(character: PlayerInformation): void {
    this.errorMessage.set('');
    const payload: JoinSessionPayload = {
      id: this.currentPreviewId,
      character,
    };
    this.socket.send(RoomSocketEvents.AddPlayerToSession, payload);
    this.clearCurrentIds();
  }

  /** HANDLERS */

  /**
   * Socket Event: RoomSocketEvents.PlayerJoinedGame
   */
  private onJoinedSession = () => {
    this.errorMessage.set('');
    void this.router.navigate(['waiting-room']);
  };

  private onClientJoinedSession = (payload: PlayerPayload) => {
    this.joinedSessionPayload = payload;
    this.errorMessage.set('');
    void this.router.navigate(['waiting-room']);
  };

  /**
   * Adds the available session to the Join Page UI
   * Event: RoomSocketEvents.NewAvailableSession
   * @param sessionPreview 
   */
  private onNewAvailableSession = (sessionPreview: GameSessionPreview) => {
    this.sessionPreviewSubjects.next([...this.sessionPreviewSubjects.value, sessionPreview]);
  };

  /**
   * Increments the number of players in the list of available game sessions
   * by its previewId
   * Event: RoomSocketEvents.IncrementPlayerCount
   * @param sessionId 
   */
  private onClientAddedToSession = (previewId: string) => {
    this.updatePlayerCount(previewId, 1);
  };

  /**
   * Decrements the number of players in the given session
   * Event: RoomSocketEvents.DecrementPlayerCount
   * @param sessionId 
   */
  private onPlayerLeft = (previewId: string) => {
    this.updatePlayerCount(previewId, -1);
  };

  /**
   * Deletes the local copy of the given session
   * Event: RoomSocketEvents.GameSessionDeleted
   * @param sessionId 
   */
  private onDeleteSession = (sessionId: string) => {
    const updated = this.sessionPreviewSubjects.value.filter(
      s => s.id !== sessionId,
    );
    this.sessionPreviewSubjects.next(updated);
  };

  private onFailedJoinSession = (message: string) => {
    this.errorMessage.set(message);
  };

  /** UTILS */
  private clearCurrentIds() {
    this.currentMapId = undefined;
    this.currentPreviewId = undefined;
  }

  private updatePlayerCount(previewId: string, delta: number): void {
    const updated = this.sessionPreviewSubjects.value.map(session =>
      session.id === previewId
        ? {
          ...session,
          nbOfPlayers: session.nbOfPlayers + delta,
          isLocked: session.nbOfPlayers + delta >= session.maxPlayers,
        }
        : session,
    );
    this.sessionPreviewSubjects.next(updated);
  }
}
