import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { ChatMessage } from '@common/chat/chat.interface';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import {
  CreateWaitingRoomPayload,
  JoinWaitingRoomPayload,
  KickWaitingRoomPlayerPayload,
  SendWaitingRoomMessagePayload,
  SocketEvents,
  WaitingRoomErrorPayload,
  WaitingRoomGameStartedPayload,
  WaitingRoomStatePayload,
} from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class WaitingRoomService {
  code = '';
  currentMapId = '';

  private mePlayer: MatchLobbyPlayer | null = null;
  private roomPlayers: MatchLobbyPlayer[] = [];
  private listenersRegistered = false;

  private readonly playersSubject = new BehaviorSubject<MatchLobbyPlayer[]>([]);
  readonly players$ = this.playersSubject.asObservable();

  private readonly messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  readonly messages$ = this.messagesSubject.asObservable();

  private readonly isLockedSubject = new BehaviorSubject(false);
  readonly isLocked$ = this.isLockedSubject.asObservable();

  private readonly maxPlayersSubject = new BehaviorSubject(0);
  readonly maxPlayers$ = this.maxPlayersSubject.asObservable();

  private readonly minPlayersToStartSubject = new BehaviorSubject(2);
  readonly minPlayersToStart$ = this.minPlayersToStartSubject.asObservable();

  private readonly statusMessageSubject = new BehaviorSubject('');
  readonly statusMessage$ = this.statusMessageSubject.asObservable();

  private readonly errorSubject = new BehaviorSubject('');
  readonly error$ = this.errorSubject.asObservable();
  private readonly waitingRoomUrl = `${environment.serverUrl}/waiting-rooms`;

  constructor(
    private readonly http: HttpClient,
    private readonly socketManager: SocketManagerService,
    private readonly router: Router,
  ) {}

  get me(): MatchLobbyPlayer | null {
    return this.mePlayer;
  }

  getPlayerSnapshot(): MatchLobbyPlayer[] {
    return this.playersSubject.value;
  }

  clearPreviewState(): void {
    this.resetState();
  }

  preloadWaitingRoom(accessCode: string): void {
    this.resetState();
    this.http.get<WaitingRoomStatePayload>(`${this.waitingRoomUrl}/${accessCode}`).subscribe({
      next: (payload) => {
        this.handleWaitingRoomUpdated(payload);
      },
      error: () => {
        this.resetState();
        this.errorSubject.next('Impossible de charger la salle d attente.');
      },
    });
  }

  initAsOrganizer(mapId: string, player: MatchLobbyPlayer): void {
    this.resetState();
    this.ensureConnected();
    this.registerListeners();

    this.currentMapId = mapId;
    this.mePlayer = {
      ...player,
      isOrganizer: true,
      controller: 'human',
    };

    this.socketManager.send<CreateWaitingRoomPayload>(SocketEvents.CreateWaitingRoom, {
      mapId,
      player: this.mePlayer,
    });
  }

  initAsPlayer(accessCode: string, player: MatchLobbyPlayer): void {
    this.ensureConnected();
    this.registerListeners();

    this.code = accessCode;
    this.mePlayer = {
      ...player,
      isOrganizer: false,
      controller: 'human',
    };

    this.socketManager.send<JoinWaitingRoomPayload>(SocketEvents.JoinWaitingRoom, {
      accessCode,
      player: this.mePlayer,
    });
  }

  initWaitingRoom(): void {
    this.ensureConnected();
    this.registerListeners();
  }

  unsubscribeSocketEvents(): void {
    if (!this.listenersRegistered) {
      return;
    }

    this.socketManager.off<WaitingRoomStatePayload>(SocketEvents.WaitingRoomUpdated, this.handleWaitingRoomUpdated);
    this.socketManager.off<ChatMessage>(SocketEvents.WaitingRoomMessageSent, this.handleWaitingRoomMessageSent);
    this.socketManager.off<WaitingRoomErrorPayload>(SocketEvents.WaitingRoomError, this.handleWaitingRoomError);
    this.socketManager.off<{ message: string }>(SocketEvents.WaitingRoomPlayerKicked, this.handleWaitingRoomCancelled);
    this.socketManager.off<{ message: string }>(SocketEvents.WaitingRoomCancelled, this.handleWaitingRoomCancelled);
    this.socketManager.off<WaitingRoomGameStartedPayload>(SocketEvents.WaitingRoomGameStarted, this.handleGameStarted);
    this.listenersRegistered = false;
  }

  deleteGameSession(): void {
    this.leaveWaitingRoom();
  }

  leaveGameSession(): void {
    this.leaveWaitingRoom();
  }

  leaveGame(): void {
    this.leaveWaitingRoom();
    this.resetState();
    void this.router.navigate(['/home']);
  }

  kickPlayer(playerId: string): void {
    if (!this.code) {
      return;
    }

    const player = this.roomPlayers.find((candidate) => candidate.id === playerId);
    if (!player) {
      return;
    }

    this.socketManager.send<KickWaitingRoomPlayerPayload>(SocketEvents.KickWaitingRoomPlayer, {
      accessCode: this.code,
      playerId: player.id,
    });
  }

  sendMessage(content: string): void {
    if (!this.code) {
      return;
    }

    this.socketManager.send<SendWaitingRoomMessagePayload>(SocketEvents.SendWaitingRoomMessage, {
      accessCode: this.code,
      content,
    });
  }

  startGame(): void {
    if (!this.code) {
      return;
    }

    this.socketManager.send(SocketEvents.StartWaitingRoomGame, { accessCode: this.code });
  }

  private ensureConnected(): void {
    if (!this.socketManager.isSocketAlive()) {
      this.socketManager.connect();
    }
  }

  private registerListeners(): void {
    if (this.listenersRegistered) {
      return;
    }

    this.listenersRegistered = true;
    this.socketManager.on<WaitingRoomStatePayload>(SocketEvents.WaitingRoomUpdated, this.handleWaitingRoomUpdated);
    this.socketManager.on<ChatMessage>(SocketEvents.WaitingRoomMessageSent, this.handleWaitingRoomMessageSent);
    this.socketManager.on<WaitingRoomErrorPayload>(SocketEvents.WaitingRoomError, this.handleWaitingRoomError);
    this.socketManager.on<{ message: string }>(SocketEvents.WaitingRoomPlayerKicked, this.handleWaitingRoomCancelled);
    this.socketManager.on<{ message: string }>(SocketEvents.WaitingRoomCancelled, this.handleWaitingRoomCancelled);
    this.socketManager.on<WaitingRoomGameStartedPayload>(SocketEvents.WaitingRoomGameStarted, this.handleGameStarted);
  }

  private readonly handleWaitingRoomUpdated = (payload: WaitingRoomStatePayload): void => {
    this.code = payload.accessCode;
    this.currentMapId = payload.mapId;
    this.roomPlayers = payload.players;
    this.playersSubject.next(payload.players);
    this.messagesSubject.next(payload.messages);
    this.isLockedSubject.next(payload.isLocked);
    this.maxPlayersSubject.next(payload.maxPlayers);
    this.minPlayersToStartSubject.next(payload.minPlayersToStart);
    this.errorSubject.next('');

    const currentPlayerId = this.mePlayer?.id ?? null;
    this.mePlayer = currentPlayerId ? payload.players.find((player) => player.id === currentPlayerId) ?? this.mePlayer : this.mePlayer;
  };

  private readonly handleWaitingRoomMessageSent = (message: ChatMessage): void => {
    this.messagesSubject.next([...this.messagesSubject.value, message]);
  };

  private readonly handleWaitingRoomError = (payload: WaitingRoomErrorPayload): void => {
    this.errorSubject.next(payload.message);
    this.statusMessageSubject.next('');
  };

  private readonly handleWaitingRoomCancelled = (payload: { message: string }): void => {
    this.resetState();
    void this.router.navigate(['/home'], {
      state: { message: payload.message },
    });
  };

  private readonly handleGameStarted = (payload: WaitingRoomGameStartedPayload): void => {
    this.statusMessageSubject.next('La partie commence.');
    void this.router.navigate(['/game-view'], {
      queryParams: { sessionId: payload.sessionId },
      state: { messages: payload.messages },
    });
  };

  private leaveWaitingRoom(): void {
    if (!this.code || !this.mePlayer) {
      return;
    }

    this.socketManager.send(SocketEvents.LeaveWaitingRoom, {
      accessCode: this.code,
      playerId: this.mePlayer.id,
    });
  }

  private resetState(): void {
    this.mePlayer = null;
    this.roomPlayers = [];
    this.code = '';
    this.currentMapId = '';
    this.playersSubject.next([]);
    this.messagesSubject.next([]);
    this.isLockedSubject.next(false);
    this.maxPlayersSubject.next(0);
    this.minPlayersToStartSubject.next(2);
    this.statusMessageSubject.next('');
    this.errorSubject.next('');
  }
}
