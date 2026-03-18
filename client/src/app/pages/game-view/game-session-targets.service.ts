import { inject, Injectable } from '@angular/core';
import { MatchPlayer } from '@common/game/match.interface';
import { TileType } from '@common/maps/map.enums';
import { positionKey } from '@app/services/match/match-geometry';
import { MatchBoardService } from '@app/services/match/match-board.service';
import { MatchMovementService, MovementDirection } from '@app/services/match/match-movement.service';
import { MOVEMENT_DIRECTIONS } from './game-session.constants';
import { GameSessionDisplayService } from './game-session-display.service';

@Injectable()
export class GameSessionTargetsService {
    private readonly display = inject(GameSessionDisplayService);
    private readonly matchBoardService = inject(MatchBoardService);
    private readonly movementService = inject(MatchMovementService);

    public canUseAction(): boolean {
        return !this.display.matchEndState() && this.isLocalPlayerTurn() && this.display.localActionAvailable();
    }

    public isLocalPlayerTurn(): boolean {
        const localPlayer = this.display.localPlayer();
        const currentTurnState = this.display.turnState();
        return !this.display.matchEndState() &&
            !!localPlayer &&
            currentTurnState?.phase === 'active' &&
            currentTurnState.activePlayerId === localPlayer.id;
    }

    public getCombatActionTargets(): Set<string> {
        return this.getCombatActionTargetsForPlayer(this.display.findPlayerById(this.display.localPlayer()?.id ?? null));
    }

    public getCombatActionTargetsForPlayer(positionedPlayer: MatchPlayer | null): Set<string> {
        const currentMatch = this.display.match();
        if (!currentMatch || !positionedPlayer) {
            return new Set<string>();
        }

        return new Set(
            currentMatch.players
                .filter((player) =>
                    player.id !== positionedPlayer.id &&
                    player.health > 0 &&
                    this.matchBoardService.areAdjacent(player.position, positionedPlayer.position),
                )
                .map((player) => positionKey(player.position)),
        );
    }

    public getDoorActionTargets(): Set<string> {
        const currentMatch = this.display.match();
        const localPlayer = this.display.findPlayerById(this.display.localPlayer()?.id ?? null);
        if (!currentMatch || !localPlayer) {
            return new Set<string>();
        }

        const adjacentDoors = currentMatch.map.filter(
            (cell) =>
                cell.tileType === TileType.DOOR &&
                Math.abs(cell.position.x - localPlayer.position.x) + Math.abs(cell.position.y - localPlayer.position.y) === 1 &&
                !(cell.isWalkable && currentMatch.players.some((player) => player.position.x === cell.position.x && player.position.y === cell.position.y)),
        );

        return new Set(adjacentDoors.map((cell) => positionKey(cell.position)));
    }

    public hasAnyActionTarget(player: MatchPlayer): boolean {
        return this.getCombatActionTargetsForPlayer(player).size > 0 || this.getDoorActionTargets().size > 0;
    }

    public hasAvailableMovement(player: MatchPlayer, movementPointsRemaining: number): boolean {
        const currentMatch = this.display.match();
        return !!currentMatch && MOVEMENT_DIRECTIONS.some((direction: MovementDirection) =>
            this.movementService.tryMove(currentMatch, player.id, direction, movementPointsRemaining).success,
        );
    }

}


