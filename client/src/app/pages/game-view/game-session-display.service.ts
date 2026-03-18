import { computed, inject, Injectable } from '@angular/core';
import { MatchPlayer, MatchTileInspection } from '@common/game/match.interface';
import { EditorCell, Vec2 } from '@common/maps/map.interface';
import { MatchMovementService } from '@app/services/match/match-movement.service';
import { MatchStateService } from '@app/services/match/match-state.service';
import { TurnStateService } from '@app/services/match/turn-state.service';
import { MILLISECONDS_PER_SECOND } from './game-session.constants';

@Injectable()
export class GameSessionDisplayService {
    private readonly matchState = inject(MatchStateService);
    private readonly turnStateService = inject(TurnStateService);
    private readonly movementService = inject(MatchMovementService);

    readonly match = computed(() => this.matchState.match());
    readonly localPlayer = this.matchState.localPlayer;
    readonly state = this.matchState.state;
    readonly errorMessage = this.matchState.errorMessage;
    readonly turnState = this.turnStateService.turnState;
    readonly matchEndState = computed(() => this.match()?.endState ?? null);
    readonly reachableTiles = computed(() => {
        const currentMatch = this.match();
        const localPlayer = this.localPlayer();
        const currentTurnState = this.turnState();

        if (!currentMatch || !localPlayer || !currentTurnState) {
            return new Map<string, number>();
        }

        if (currentTurnState.phase !== 'active' || currentTurnState.activePlayerId !== localPlayer.id) {
            return new Map<string, number>();
        }

        return this.movementService.getReachableTiles(
            currentMatch,
            localPlayer.id,
            currentTurnState.movementPointsRemaining,
        );
    });
    public avatarUrl(avatarId: string | number): string {
        return `assets/avatars/thumbs/${avatarId}.png`;
    }

    public playerAt(tile: EditorCell): MatchPlayer | null {
        return this.matchState.getPlayerAt(tile.position);
    }

    public inspectTile(position: Vec2): MatchTileInspection | null {
        return this.matchState.inspectTile(position);
    }

    public turnOrderedPlayers(): MatchPlayer[] {
        const currentMatch = this.match();
        const currentTurnState = this.turnState();
        if (!currentMatch || !currentTurnState) {
            return [];
        }

        const playersById = new Map(currentMatch.players.map((player) => [player.id, player]));
        return currentTurnState.order
            .map((entry) => playersById.get(entry.playerId) ?? null)
            .filter((player): player is MatchPlayer => player !== null);
    }

    public currentActivePlayer(): MatchPlayer | null {
        return this.findPlayerById(this.turnState()?.activePlayerId ?? null);
    }

    public transitionTargetPlayer(): MatchPlayer | null {
        return this.findPlayerById(this.turnState()?.transitionTargetPlayerId ?? null);
    }

    public transitionCountdownSeconds(): number {
        return this.toCountdownSeconds(this.turnState()?.transitionRemainingMs ?? 0);
    }

    public activeTurnCountdownSeconds(): number {
        return this.toCountdownSeconds(this.turnState()?.activeTurnRemainingMs ?? 0);
    }

    public localPlayerStateLabel(): string {
        const localPlayer = this.localPlayer();
        const playerState = this.turnState()?.playerStates.find((entry) => entry.playerId === localPlayer?.id)?.state ?? 'waiting';

        switch (playerState) {
            case 'active':
                return 'Actif';
            default:
                return 'En attente';
        }
    }

    public localMovementCount(): number {
        return this.turnState()?.movementCount ?? 0;
    }

    public localMovementPointsRemaining(): number {
        return this.turnState()?.movementPointsRemaining ?? 0;
    }

    public localActionAvailable(): boolean {
        const localPlayer = this.localPlayer();
        return !!localPlayer && this.turnStateService.canPerformAction(localPlayer.id);
    }

    public findPlayerById(playerId: string | null): MatchPlayer | null {
        if (!playerId) {
            return null;
        }

        return this.match()?.players.find((player) => player.id === playerId) ?? null;
    }

    private toCountdownSeconds(remainingMs: number): number {
        return Math.max(0, Math.ceil(remainingMs / MILLISECONDS_PER_SECOND));
    }
}
