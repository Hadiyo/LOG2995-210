import { inject, Injectable } from '@angular/core';
import { MatchPlayer } from '@common/game/match.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { positionKey } from '@app/services/match/match-geometry';
import { MatchBoardService } from '@app/services/match/match-board.service';
import { MatchMovementService, MovementDirection } from '@app/services/match/match-movement.service';
import { MOVEMENT_DIRECTIONS } from '@app/config/game-session.config';
import { GameSessionDisplayService } from './game-session-display.service';

@Injectable()
export class GameSessionTargetsService {
    private readonly display = inject(GameSessionDisplayService);
    private readonly matchBoardService = inject(MatchBoardService);
    private readonly movementService = inject(MatchMovementService);

    canUseAction(): boolean {
        return !this.display.matchEndState() && this.isLocalPlayerTurn() && this.display.localActionAvailable();
    }

    isLocalPlayerTurn(): boolean {
        const localPlayer = this.display.localPlayer();
        const currentTurnState = this.display.turnState();
        return !this.display.matchEndState() &&
            !!localPlayer &&
            currentTurnState?.phase === 'active' &&
            currentTurnState.activePlayerId === localPlayer.id;
    }

    getCombatActionTargets(): Set<string> {
        return this.getCombatActionTargetsForPlayer(this.display.findPlayerById(this.display.localPlayer()?.id ?? null));
    }

    getCombatActionTargetsForPlayer(positionedPlayer: MatchPlayer | null): Set<string> {
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

    getDoorActionTargets(): Set<string> {
        return this.getDoorActionTargetsForPlayer(this.display.findPlayerById(this.display.localPlayer()?.id ?? null));
    }

    getDoorActionTargetsForPlayer(positionedPlayer: MatchPlayer | null): Set<string> {
        const currentMatch = this.display.match();
        if (!currentMatch || !positionedPlayer) {
            return new Set<string>();
        }

        const adjacentDoors = currentMatch.map.filter((cell) => {
            const isAdjacent =
                Math.abs(cell.position.x - positionedPlayer.position.x) +
                    Math.abs(cell.position.y - positionedPlayer.position.y) ===
                1;
            const occupiedByPlayer = currentMatch.players.some(
                (player) => player.position.x === cell.position.x && player.position.y === cell.position.y,
            );
            const occupiedByFlag = currentMatch.mode === GameMode.CTF &&
                currentMatch.objects.some(
                    (object) =>
                        object.type === ObjectType.FLAG &&
                        object.position.x === cell.position.x &&
                        object.position.y === cell.position.y,
                );
            return cell.tileType === TileType.DOOR && isAdjacent && !(cell.isWalkable && (occupiedByPlayer || occupiedByFlag));
        });

        return new Set(adjacentDoors.map((cell) => positionKey(cell.position)));
    }

    getSanctuaryActionTargets(): Set<string> {
        return this.getSanctuaryActionTargetsForPlayer(this.display.findPlayerById(this.display.localPlayer()?.id ?? null));
    }

    getSanctuaryActionTargetsForPlayer(positionedPlayer: MatchPlayer | null): Set<string> {
        const currentMatch = this.display.match();
        if (!currentMatch || !positionedPlayer) {
            return new Set<string>();
        }

        return new Set(
            currentMatch.allObjects
                .filter((object) =>
                    this.matchBoardService.isSanctuaryObject(object) &&
                    this.matchBoardService.isSanctuaryActive(currentMatch, object.id) &&
                    !(object.type === ObjectType.ARENA && (positionedPlayer.arenaBuffTurnsRemaining ?? 0) > 0) &&
                    this.matchBoardService.objectFootprint(object)
                        .some((tile) => this.matchBoardService.areAdjacent(positionedPlayer.position, tile)),
                )
                .flatMap((object) => this.matchBoardService.objectFootprint(object))
                .map((position) => positionKey(position)),
        );
    }

    hasAnyActionTarget(player: MatchPlayer): boolean {
        return this.getCombatActionTargetsForPlayer(player).size > 0 ||
            this.getDoorActionTargetsForPlayer(player).size > 0 ||
            this.getSanctuaryActionTargetsForPlayer(player).size > 0;
    }

    hasAvailableMovement(player: MatchPlayer, movementPointsRemaining: number): boolean {
        const currentMatch = this.display.match();
        return !!currentMatch && MOVEMENT_DIRECTIONS.some((direction: MovementDirection) =>
            this.movementService.tryMove(currentMatch, player.id, direction, movementPointsRemaining).success,
        );
    }
}
