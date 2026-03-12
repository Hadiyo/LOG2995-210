import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { GAME_STORAGE_KEYS, LocalGameStateService } from '@app/services/game/local-game-state.service';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import {
  GameStartedPayload,
  PlayerPayload,
  WaitingRoomRedirectPayload,
  WaitingRoomStatePayload
} from '@common/game/game-session.interface';
import { PlayerInformation } from '@common/player/player.interface';
import { ErrorSocketEvents, WaitingRoomEvents } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';
import { ChatService } from '../chat/chat.service';

@Injectable({
  providedIn: 'root',
})
export class WaitingRoomService {
  me?: PlayerInformation;

  private playersSubjects = new BehaviorSubject<PlayerInformation[]>([]);
  readonly players$ = this.playersSubjects.asObservable();

  private isLockedSubject = new BehaviorSubject(false);
  readonly isLocked$ = this.isLockedSubject.asObservable();

  private maxPlayersSubject = new BehaviorSubject(0);
  readonly maxPlayers$ = this.maxPlayersSubject.asObservable();

  private minPlayersToStartSubject = new BehaviorSubject(2);
  readonly minPlayersToStart$ = this.minPlayersToStartSubject.asObservable();

  private statusMessageSubject = new BehaviorSubject('');
  readonly statusMessage$ = this.statusMessageSubject.asObservable();

  constructor(
    private readonly socket: SocketManagerService,
    private readonly router: Router,
    private readonly localGameStateService: LocalGameStateService,
    private readonly chatService: ChatService,
  ) {}

  initWaitingRoom(): void {
    if (!this.socket.isSocketAlive()) {
      this.socket.connect();
    }

    this.subscribeToSocketEvents();
  }

  hydrateWaitingRoom(payload: PlayerPayload | undefined): void {
    if (!payload) {
      return;
    }

    this.onClientJoinedSession(payload);
  }

  unsubscribeSocketEvents(): void {
    this.socket.off<PlayerInformation>(WaitingRoomEvents.PlayerJoinedSession, this.onJoinedPlayer);
    this.socket.off<PlayerInformation>(WaitingRoomEvents.PlayerLeftSession, this.onPlayerLeft);
    this.socket.off<PlayerPayload>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.off<WaitingRoomStatePayload>(WaitingRoomEvents.WaitingRoomState, this.onWaitingRoomState);
    this.socket.off<WaitingRoomRedirectPayload>(WaitingRoomEvents.GameSessionDeleted, this.onDeletedSession);
    this.socket.off<WaitingRoomRedirectPayload>(WaitingRoomEvents.KickedFromSession, this.onKickedFromSession);
    this.socket.off<GameStartedPayload>(WaitingRoomEvents.GameStarted, this.onGameStarted);
    this.socket.off<string>(ErrorSocketEvents.ServerError, this.onServerError);
    this.resetState();
  }

  deleteGameSession(): void {
    this.socket.send(WaitingRoomEvents.DeleteGameSession);
  }

  leaveGameSession(): void {
    this.socket.send(WaitingRoomEvents.LeaveGameRoom);
  }

  kickPlayer(playerName: string): void {
    this.socket.send(WaitingRoomEvents.KickPlayer, playerName);
  }

  startGame(): void {
    this.socket.send(WaitingRoomEvents.StartGame);
  }

  private subscribeToSocketEvents(): void {
    this.socket.on<PlayerInformation>(WaitingRoomEvents.PlayerJoinedSession, this.onJoinedPlayer);
    this.socket.on<PlayerInformation>(WaitingRoomEvents.PlayerLeftSession, this.onPlayerLeft);
    this.socket.on<PlayerPayload>(WaitingRoomEvents.ClientJoinedSession, this.onClientJoinedSession);
    this.socket.on<WaitingRoomStatePayload>(WaitingRoomEvents.WaitingRoomState, this.onWaitingRoomState);
    this.socket.on<WaitingRoomRedirectPayload>(WaitingRoomEvents.GameSessionDeleted, this.onDeletedSession);
    this.socket.on<WaitingRoomRedirectPayload>(WaitingRoomEvents.KickedFromSession, this.onKickedFromSession);
    this.socket.on<GameStartedPayload>(WaitingRoomEvents.GameStarted, this.onGameStarted);
    this.socket.on<string>(ErrorSocketEvents.ServerError, this.onServerError);
  }

  private onClientJoinedSession = (payload: PlayerPayload) => {
    this.me = payload.clientPlayer;
    this.playersSubjects.next(payload.players);
    this.isLockedSubject.next(payload.isLocked);
    this.maxPlayersSubject.next(payload.maxPlayers);
  };

  private onWaitingRoomState = (payload: WaitingRoomStatePayload | undefined) => {
    if (!payload) return;
    this.playersSubjects.next(payload.players);
    this.isLockedSubject.next(payload.isLocked);
    this.chatService.loadChatMessages(payload.messages);
    this.maxPlayersSubject.next(payload.maxPlayers);
    this.minPlayersToStartSubject.next(payload.minPlayersToStart);
  };

  private onJoinedPlayer = (player: PlayerInformation) => {
    if (this.playersSubjects.value.some((participant) => participant.name === player.name)) {
      return;
    }

    this.playersSubjects.next([...this.playersSubjects.value, player]);
    this.statusMessageSubject.next(`${player.name} a rejoint la salle d'attente.`);
  };

  private onPlayerLeft = (player: PlayerInformation) => {
    const updatedPlayers = this.playersSubjects.value.filter(
      (participant) => participant.name !== player.name,
    );
    this.playersSubjects.next(updatedPlayers);
    this.statusMessageSubject.next(`${player.name} a quitte la salle d'attente.`);
  };

  private onDeletedSession = (payload: WaitingRoomRedirectPayload) => {
    void this.router.navigate(['/home'], {
      state: { message: payload.reason },
    });
  };

  private onKickedFromSession = (payload: WaitingRoomRedirectPayload) => {
    void this.router.navigate(['/home'], {
      state: { message: payload.reason },
    });
  };

  private onGameStarted = (payload: GameStartedPayload) => {
    const currentPlayer = payload.snapshot.players.find(
      (player) => player.information.name === this.me?.name,
    );
    if (!currentPlayer) {
      return;
    }

    this.localGameStateService.applyLocalSnapshot(payload.snapshot);
    sessionStorage.setItem(GAME_STORAGE_KEYS.sessionId, payload.snapshot.id);
    sessionStorage.setItem(GAME_STORAGE_KEYS.playerId, currentPlayer.id);
    void this.router.navigate(['/game-view'], {
      queryParams: {
        sessionId: payload.snapshot.id,
        playerId: currentPlayer.id,
      },
    });
  };

  private onServerError = (message: string) => {
    this.statusMessageSubject.next(message || 'Une erreur serveur est survenue.');
  };

  private resetState(): void {
    this.playersSubjects.next([]);
    this.isLockedSubject.next(false);
    this.maxPlayersSubject.next(0);
    this.minPlayersToStartSubject.next(2);
    this.statusMessageSubject.next('');
    this.me = undefined;
  }
}
