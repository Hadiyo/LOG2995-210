import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { CreateSessionPayload, GameSessionPreview, JoinSessionPayload, PlayerPayload } from '@common/game/game-session.interface';
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

  private currentMapId?: string;
  private currentPreviewId?: string;

  readonly state = signal<ServiceState>(ServiceState.Idle);

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
  }

  clearCurrentIds() {
    this.currentMapId = undefined;
    this.currentPreviewId = undefined;
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
    this.socket.on<CreateSessionPayload>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
    this.socket.on<string>(RoomSocketEvents.IncrementPlayerCount, this.onClientAddedToSession);
    this.socket.on<PlayerPayload>(RoomSocketEvents.PlayerJoinedGame, this.onJoinedSession);
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
    this.socket.off<string>(RoomSocketEvents.IncrementPlayerCount, this.onClientAddedToSession);
    this.socket.off<PlayerPayload>(RoomSocketEvents.PlayerJoinedGame, this.onJoinedSession);
    this.socket.off<string>(RoomSocketEvents.DecrementPlayerCount, this.onPlayerLeft);
    this.socket.off<string>(RoomSocketEvents.GameSessionDeleted, this.onDeleteSession);
    this.socket.off<GameSessionPreview>(RoomSocketEvents.NewAvailableSession, this.onNewAvailableSession);
  }

  /**
   * Create a game session and redirect the user to the waiting room
   * corresponding to its sessionId. Requires the client socket id
   * @param payload 
   */
  createGameSession(character: PlayerInformation): void {
    const payload: JoinSessionPayload = {
      id: this.currentMapId,
      character,
    };
    this.socket.send(RoomSocketEvents.CreateGameSession, payload);
    this.clearCurrentIds();
  }

  /**
   * Client request to join a game session
   * @param sessionId 
   */
  joinGameSession(character: PlayerInformation): void {
    const payload: JoinSessionPayload = {
      id: this.currentPreviewId,
      character,
    };
    this.socket.send(RoomSocketEvents.JoinGameRoom, payload);
    this.clearCurrentIds();
  }

  /**
 * Requests the server to delete the game session
 * @param sessionId 
 */
  deleteGameSession(sessionId: string): void {
    this.socket.send(RoomSocketEvents.DeleteGameSession, sessionId);
  }

  /**
   * Client request to leave a game session
   * @param sessionId 
   */
  leaveGameSession(sessionId: string): void {
    this.socket.send(RoomSocketEvents.LeaveGameRoom, sessionId);
  }

  /**
   * Navigate the user to the waiting room using the new sessionId
   * @param sessionId 
   */
  private onSessionCreated = (payload: CreateSessionPayload) => {
    // Add new mapPreview to Join Page
    if (payload.mapPreview) {
      this.sessionPreviewSubjects.next([...this.sessionPreviewSubjects.value, payload.mapPreview]);
    }
    // Add player to waiting room
    void payload.player;
    // Re-direct to waiting-room with sessionId
    this.router.navigate(['waiting-room', payload.sessionId]);
  };

  private onJoinedSession = (payload: PlayerPayload) => {
    // Increase player count in session by 1
    this.updatePlayerCount(payload.mapPreviewId, 1);
    // Add player to waiting room
    void payload.player;
    // Re-direct to waiting-room with sessionId
    this.router.navigate(['waiting-room', payload.sessionId]);
  };

  /**
   * Adds the available session to the Join Page UI
   * @param sessionPreview 
   */
  private onNewAvailableSession = (sessionPreview: GameSessionPreview) => {
    this.sessionPreviewSubjects.next([...this.sessionPreviewSubjects.value, sessionPreview]);
  };

  /**
   * Increments the number of players in the list of available game sessions
   * by its previewId
   * @param sessionId 
   */
  private onClientAddedToSession = (previewId: string) => {
    this.updatePlayerCount(previewId, 1);
  };

  /**
   * Decrements the number of players in the given session
   * @param sessionId 
   */
  private onPlayerLeft = (previewId: string) => {
    this.updatePlayerCount(previewId, -1);
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

  private updatePlayerCount(sessionId: string, delta: number): void {
    const updated = this.sessionPreviewSubjects.value.map(session =>
      session.id === sessionId
        ? { ...session, playerCount: session.nbOfPlayers + delta }
        : session,
    );
    this.sessionPreviewSubjects.next(updated);
  }
}
