import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { CreateSessionPayload, GameSessionPayload, GameSessionPreview } from '@common/game/game-session.interface';
import { PlayerInformation } from '@common/player/player.interface';
import { PageContext, PageSocketEvents, RoomSocketEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';
import { SessionApiService } from './session-api.service';

/**
 * This services allows a client to join, leave, create and delete game sessions which will later
 * be used for further real-time multiplayer gaming
 */

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private sessionPreviewSubjects = new BehaviorSubject<GameSessionPreview[]>([]);
  sessionsPreview$ = this.sessionPreviewSubjects.asObservable();

  private contextSubject = new BehaviorSubject<'create' | 'join' | null>(null);
  context$ = this.contextSubject.asObservable();

  private currentSessionId = signal<string>(''); // To keep track of the sessionId when switching to character creation
  sessionId = this.currentSessionId.asReadonly();

  readonly state = signal<ServiceState>(ServiceState.Idle);

  private api = inject(SessionApiService);

  constructor(private socket: SocketManagerService, private readonly router: Router) {}

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

  setContext(context: 'create' | 'join') {
    this.contextSubject.next(context);
  }

  /**
   * Create a game session and redirect the user to the waiting room
   * corresponding to its sessionId. Requires the client socket id
   * @param payload 
   */
  createGameSession(mapId: string): void {
    this.socket.send(RoomSocketEvents.CreateGameSession, mapId);
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
  joinGameSession(previewId: string): void {
    this.socket.send(RoomSocketEvents.JoinGameRoom, previewId);
  }

  /**
   * Client request to leave a game session
   * @param sessionId 
   */
  leaveGameSession(sessionId: string): void {
    this.socket.send(RoomSocketEvents.LeaveGameRoom, sessionId);
  }

  /**
   * Allows the client to add the PlayerInformation to the gameSession it is connected to
   * after the client has connected to the session
   */
  addCharacterToPlayerSession(player: PlayerInformation): void {
    const payload: GameSessionPayload = {
      information: player,
      sessionId: this.sessionId(),
    };
    this.socket.send(RoomSocketEvents.AddCharacterToPlayer, payload);
    this.router.navigate(['waiting-room', this.sessionId()]);
  }

  /**
   * Subscribes to all real-time socket events related to JoinPage
   */
  subscribeToSessionEvents() {
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
    this.socket.send(PageSocketEvents.JoinPage, { page: PageContext.JoinGame });
    this.socket.on<CreateSessionPayload>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
    this.socket.on<string>(RoomSocketEvents.AddClientToSession, this.onClientAddedToSession);
    this.socket.on<string>(RoomSocketEvents.IncrementPlayerCount, this.onJoinedPlayer);
    this.socket.on<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.on<string>(RoomSocketEvents.GameSessionDeleted, this.onDeleteSession);
    this.socket.on<GameSessionPreview>(RoomSocketEvents.NewAvailableSession, this.onNewAvailableSession);
  }

  /**
  * Unsubscribes to all real-time socket events related to JoinPage
  */
  unsubscribeToSessionEvents() {
    this.socket.send(PageSocketEvents.LeavePage, { page: PageContext.JoinGame });
    this.socket.off<CreateSessionPayload>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
    this.socket.off<string>(RoomSocketEvents.AddClientToSession, this.onClientAddedToSession);
    this.socket.off<string>(RoomSocketEvents.IncrementPlayerCount, this.onJoinedPlayer);
    this.socket.off<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.off<string>(RoomSocketEvents.GameSessionDeleted, this.onDeleteSession);
    this.socket.off<GameSessionPreview>(RoomSocketEvents.NewAvailableSession, this.onNewAvailableSession);
  }

  /**
   * Navigate the user to the waiting room using the new sessionId
   * @param sessionId 
   */
  private onSessionCreated = (sessionPreview: CreateSessionPayload) => {
    if (sessionPreview.sessionId) {
      this.sessionPreviewSubjects.next([...this.sessionPreviewSubjects.value, sessionPreview.mapPreview]);
      this.setCurrentSessionId(sessionPreview.sessionId);
    }
  };

  private onClientAddedToSession = (sessionId: string) => {
    this.setCurrentSessionId(sessionId);
  };

  private onNewAvailableSession = (sessionPreview: GameSessionPreview) => {
    this.sessionPreviewSubjects.next([...this.sessionPreviewSubjects.value, sessionPreview]);
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

  // private onClientPlayerAdded = (sessionId: string) => {
  //   console.log(sessionId);
  //   this.router.navigate(['waiting-room', sessionId]);
  // };

  /**
   * Allows components to keep track of a session id upon creating or joining a session
   * to allow the client to send the character payload
   */
  private setCurrentSessionId(id: string): void {
    this.currentSessionId.set(id);
  }
}
