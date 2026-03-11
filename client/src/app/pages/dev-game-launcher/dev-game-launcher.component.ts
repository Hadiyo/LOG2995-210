import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MAP_SIZE_CONFIG } from '@app/config/map.config';
import { GAME_STORAGE_KEYS, LocalGameStateService } from '@app/services/game/local-game-state.service';
import { MapApiService } from '@app/services/map/map-api.service';
import { AvatarId } from '@common/character/character.model';
import { TurnPhase } from '@common/game-session';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMap, MapObject } from '@common/maps/map.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';
import { catchError, map, of, take } from 'rxjs';

// Radix for random ID generation (base 36 for alphanumeric characters)
const BASE36_RADIX = 36;
// String slicing boundaries for random ID generation
const RANDOM_ID_START = 2;
const RANDOM_ID_END = 10;
// SessionStorage keys for tab-scoped dev session and player assignments
const DEV_SESSION_ID_KEY = 'devLauncherSessionId';
const DEV_ASSIGNMENTS_KEY = 'devLauncherAssignments';
// SessionStorage key for unique client identifier
const DEV_CLIENT_ID_KEY = 'devLauncherClientId';
// Default character stats for dev players
const DEFAULT_HEALTH = 8;
const DEFAULT_SPEED = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_ACTIONS = 1;
const DEFAULT_MOVEMENT = 6;
const DEFAULT_TURN_DURATION_SECONDS = 30;
// Fallback map sizes if the selected map has no size configured
const FALLBACK_MAP_SIZES: readonly MapSize[] = [MapSize.S, MapSize.M, MapSize.L];
const FALLBACK_START_MARGIN = 1;
// Predefined roster of dev players for testing
const DEV_ROSTER: readonly { id: string; name: string; avatarId: AvatarId; isOrganizer: boolean }[] = [
  { id: 'dev-player-1', name: 'DevPlayer-1', avatarId: 0, isOrganizer: true },
  { id: 'dev-player-2', name: 'DevPlayer-2', avatarId: 0, isOrganizer: false },
  { id: 'dev-player-3', name: 'DevPlayer-3', avatarId: 0, isOrganizer: false },
  { id: 'dev-player-4', name: 'DevPlayer-4', avatarId: 0, isOrganizer: false },
  { id: 'dev-player-5', name: 'DevPlayer-5', avatarId: 0, isOrganizer: false },
  { id: 'dev-player-6', name: 'DevPlayer-6', avatarId: 0, isOrganizer: false },
];
// Maps session ID -> client ID -> player ID for managing player slot assignments
type DevAssignments = Record<string, Record<string, string>>;

/**
 * Dev Game Launcher Component
 * Initializes and manages development game sessions for testing.
 * Handles session creation, player assignment, and navigation to game view.
 */
@Component({
  selector: 'app-dev-game-launcher',
  standalone: true,
  imports: [],
  templateUrl: './dev-game-launcher.component.html',
})
export class DevGameLauncherComponent {
  constructor(
    private readonly mapApiService: MapApiService,
    private readonly localGameStateService: LocalGameStateService,
    private readonly router: Router,
  ) {}

  /**
   * Main entry point: starts or resumes a local dev game session.
   * static mode only. Replace with backend game session flow when ready.
   */
  startDevGame(): void {
    const existingSessionId = sessionStorage.getItem(DEV_SESSION_ID_KEY);
    const currentClientId = this.getOrCreateClientId();

    this.getOrCreateDevSession(existingSessionId).pipe(
      take(1),
      map((session) => {
        const playerId = this.assignPlayerSlot(session.id, currentClientId, session.players);
        return { sessionId: session.id, playerId };
      }),
    ).subscribe({
      next: (assignment) => {
        sessionStorage.setItem(GAME_STORAGE_KEYS.sessionId, assignment.sessionId);
        sessionStorage.setItem(GAME_STORAGE_KEYS.playerId, assignment.playerId);
        void this.router.navigate(['/game-view'], {
          queryParams: {
            sessionId: assignment.sessionId,
            playerId: assignment.playerId,
          },
        });
      },
    });
  }

  /**
   * Retrieves existing local session or creates a new one if unavailable/ended.
   * static mode only. In backend mode this should use /games snapshot validation.
   */
  private getOrCreateDevSession(existingSessionId: string | null) {
    if (existingSessionId) {
      const existingSession = this.localGameStateService.getLocalSessionSnapshot(existingSessionId);
      if (existingSession && !this.isSessionEnded(existingSession) && !this.hasNoActivePlayers(existingSession.players)) {
        return of(existingSession);
      }
      this.clearStoredDevSession(existingSessionId);
    }

    return this.createNewDevSession();
  }

  /**
   * Creates a new local dev session with a random available map from DB.
   * static mode only. Keeps map loading from backend, but game runtime is local-only.
   */
  private createNewDevSession() {
    return this.mapApiService.getVisibleMaps().pipe(
      take(1),
      map((maps) => {
        const selectedMap =
          maps[Math.floor(2)] ??
          this.createFallbackEditorMap(this.getRandomFallbackMapSize());
        return this.createLocalSessionFromMap(selectedMap);
      }),
      catchError(() => {
        const fallbackMap = this.createFallbackEditorMap(this.getRandomFallbackMapSize());
        return of(this.createLocalSessionFromMap(fallbackMap));
      }),
    );
  }

  /**
   * Builds the player roster for the dev game, limited by map max player count.
   * Each player gets default stats and is set to Active status.
   */
  private buildDevRoster(maxPlayers: number): Player[] {
    const rosterLimit = Math.max(1, maxPlayers);
    return DEV_ROSTER.slice(0, rosterLimit).map((entry) => ({
        id: entry.id,
        information: {
            name: entry.name,
            avatarId: entry.avatarId,
            isOrganizer: entry.isOrganizer,
            dices: {
                attack: 'D6',
                defense: 'D4',
            },
            bonus: 'speed',
        },
        state: {
            position: {x: 0, y: 1},
            status: PlayerStatus.Active,
            attributes: { health: DEFAULT_HEALTH, maxHealth: DEFAULT_HEALTH, speed: DEFAULT_SPEED, attack: DEFAULT_ATTACK, defense: DEFAULT_DEFENSE },
            wins: 0,
            remainingActions: DEFAULT_ACTIONS,
            remainingMovements: DEFAULT_MOVEMENT,
        },
        render: {
            facing: 'front',
            pose: 'idle',
        },
    }));
  }

  /**
   * Assigns a player slot to the client.
   * Returns existing assignment if still valid, or finds first available player.
   * Falls back to first dev player if none available.
   */
  private assignPlayerSlot(sessionId: string, clientId: string, players: readonly Player[]): string {
    const assignments = this.readAssignments();
    const perSessionAssignments = assignments[sessionId] ?? {};
    const existingPlayerId = perSessionAssignments[clientId];
    const validPlayerIds = new Set(players.map((player) => player.id));

    // Return existing valid assignment if available
    if (existingPlayerId && validPlayerIds.has(existingPlayerId)) {
      return existingPlayerId;
    }

    // Find first available player slot not assigned to other clients
    const takenPlayerIds = new Set(
      Object.values(perSessionAssignments).filter((playerId) => validPlayerIds.has(playerId)),
    );
    const availablePlayer = players.find((player) => !takenPlayerIds.has(player.id));
    const selectedPlayerId = availablePlayer?.id ?? DEV_ROSTER[0].id;

    // Persist the assignment
    perSessionAssignments[clientId] = selectedPlayerId;
    assignments[sessionId] = perSessionAssignments;
    sessionStorage.setItem(DEV_ASSIGNMENTS_KEY, JSON.stringify(assignments));

    return selectedPlayerId;
  }

  /**
   * Checks if all players are inactive (game ended or all disconnected).
   */
  private hasNoActivePlayers(players: readonly Player[]): boolean {
    return !players.some((player) => player.state.status === PlayerStatus.Active);
  }

  /**
   * Checks if session has reached its end state (transition phase with no active player).
   */
  private isSessionEnded(session: { turn: { activePlayerId: string; phase: TurnPhase } }): boolean {
    return session.turn.phase === TurnPhase.Transition && session.turn.activePlayerId === '';
  }

  /**
   * Returns max player count for a given map size from config.
   * Falls back to full roster size if config not found.
   */
  private getMapMaxPlayers(size: MapSize): number {
    const mapOption = MAP_SIZE_CONFIG.find((option) => option.value === size);
    if (!mapOption) {
      return DEV_ROSTER.length;
    }
    return mapOption.maxPlayers;
  }

  /**
   * Randomly selects a fallback map size (S, M, or L).
   */
  private getRandomFallbackMapSize(): MapSize {
    const randomIndex = Math.floor(Math.random() * FALLBACK_MAP_SIZES.length);
    return FALLBACK_MAP_SIZES[randomIndex] ?? MapSize.S;
  }

  // static mode only. Local session bootstrap helper.
  private createLocalSessionFromMap(editorMap: EditorMap) {
    const mapPlayersLimit = this.getMapMaxPlayers(editorMap.size);
    const session = this.localGameStateService.createLocalSession({
      map: editorMap,
      players: this.buildDevRoster(mapPlayersLimit),
      turnDurationSeconds: DEFAULT_TURN_DURATION_SECONDS,
      debugMode: true,
    });

    sessionStorage.setItem(DEV_SESSION_ID_KEY, session.id);
    this.clearAssignmentsForSession(session.id);
    return session;
  }

  // static mode only. Fallback map for local static mode.
  private createFallbackEditorMap(size: MapSize): EditorMap {
    const cellCount = size * size;
    const cells: EditorCell[] = Array.from({ length: cellCount }, () => ({
      tileType: TileType.DIRT,
      isWalkable: true,
      isOccupied: false,
    }));

    return {
      id: `local-fallback-${Date.now()}`,
      name: `Local Map ${size}`,
      description: 'Generated fallback map for static mode',
      date: new Date().toISOString(),
      size,
      mode: GameMode.CLASSIC,
      objects: this.createFallbackStartObjects(size),
      map: cells,
      visibility: true,
    };
  }

  private createFallbackStartObjects(size: MapSize): MapObject[] {
    const maxCoordinate = size - FALLBACK_START_MARGIN - 1;
    const centerCoordinate = Math.floor(size / 2);
    const positions = [
      { x: FALLBACK_START_MARGIN, y: FALLBACK_START_MARGIN },
      { x: maxCoordinate, y: FALLBACK_START_MARGIN },
      { x: FALLBACK_START_MARGIN, y: maxCoordinate },
      { x: maxCoordinate, y: maxCoordinate },
      { x: centerCoordinate, y: FALLBACK_START_MARGIN },
      { x: centerCoordinate, y: maxCoordinate },
    ];

    return positions.map((position, index) => ({
      id: index + 1,
      type: ObjectType.START,
      position,
      size: ObjectSize.S,
    }));
  }

  /**
   * Removes the stored session ID and clears all player assignments.
   */
  private clearStoredDevSession(sessionId: string): void {
    sessionStorage.removeItem(DEV_SESSION_ID_KEY);
    this.clearAssignmentsForSession(sessionId);
  }

  /**
   * Clears all player assignments for a specific session (resets slot availability).
   */
  private clearAssignmentsForSession(sessionId: string): void {
    const assignments = this.readAssignments();
    assignments[sessionId] = {};
    sessionStorage.setItem(DEV_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  }

  /**
   * Reads player assignments from sessionStorage with error handling.
   * Returns empty object if parsing fails.
   */
  private readAssignments(): DevAssignments {
    const rawValue = sessionStorage.getItem(DEV_ASSIGNMENTS_KEY);
    if (!rawValue) return {};

    try {
      return JSON.parse(rawValue) as DevAssignments;
    } catch {
      return {};
    }
  }

  /**
   * Gets or generates a unique client ID persisted in session storage.
   * Used to identify the same browser across page reloads.
   */
  private getOrCreateClientId(): string {
    const existingClientId = sessionStorage.getItem(DEV_CLIENT_ID_KEY);
    if (existingClientId) return existingClientId;

    const generatedClientId = `dev-client-${Math.random().toString(BASE36_RADIX).slice(RANDOM_ID_START, RANDOM_ID_END)}`;
    sessionStorage.setItem(DEV_CLIENT_ID_KEY, generatedClientId);
    return generatedClientId;
  }
}
