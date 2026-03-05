import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { CreateSessionPayload, GameSessionPreview } from '@common/game/game-session.interface';
import { RoomSocketEvents } from '@common/socket-events';
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
    // Stay alert for navigator window closer to disconnect the client
    this.socket.subscribeToWindowEvent();
    this.loadGameSessions();
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
   * corresponding to its sessionId
   * @param payload 
   */
  createGameSession(payload: CreateSessionPayload): void {
    this.socket.send(RoomSocketEvents.CreateGameSession, payload);
  }

  subscribeToSessionEvents() {
    this.socket.on<string>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
  }

  unsubscribeToSessionEvents() {
    this.socket.off<string>(RoomSocketEvents.GameSessionCreated, this.onSessionCreated);
  }

  // Handle gameSessionCreates
  private onSessionCreated = (sessionId: string) => {
    // TODO: CALL CHAT INIT METHOD
    this.router.navigate(['waiting-room', sessionId]);
  };

  // Handle player joining

  // Handle player leaving

  // Handle session deletion

}
