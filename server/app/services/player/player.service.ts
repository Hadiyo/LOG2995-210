import { InternalPlayer } from '@app/interface/player.interface';
import { ObjectType } from '@common/maps/map.enums';
import { GameCell, GameMap } from '@common/maps/map.interface';
import { Player, PlayerFacing, PlayerInformation, PlayerPose, PlayerRenderState, PlayerState, PlayerStatus } from '@common/player/player.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

const DEFAULT_ACTIONS_PER_TURN = 1;

@Injectable()
export class PlayerService {

    /** HOLD ALL PLAYERS AND THEIR REFERENCE TO THE GAME THEY ARE IN */
    private players = new Map<string, InternalPlayer>();

    getPlayerById(id: string): InternalPlayer {
        return this.players.get(id);
    }

    getPlayerBySocketId(socketId: string): InternalPlayer | undefined {
        for (const internalPlayer of this.players.values()) {
            if (internalPlayer.socketId === socketId) {
                return internalPlayer;
            }
        }
        return undefined;
    }

    getPlayerByName(name: string): InternalPlayer | undefined {
        for (const internalPlayer of this.players.values()) {
            if (internalPlayer.player.information.name === name) {
                return internalPlayer;
            }
        }
        return undefined;
    }

    /**
     * Saves player input to the list of players and create a unique reference id
     * @returns the player unique id
     */
    savePlayer(info: PlayerInformation, clientId: string): Player {
        const newPlayer: Player = {
            id: randomUUID(),
            information: info,
            state: this.setPlayerInitialState(),
            render: this.setPlayerInitialRenderState(),
        };

        const newInternalPlayer: InternalPlayer = {
            socketId: clientId,
            player: newPlayer,
        };

        this.players.set(newPlayer.id, newInternalPlayer);
        return newPlayer;
    }

    /** Remove the player from the list of players */
    removePlayer(playerId: string): void {
        this.players.delete(playerId);
    }

    createRuntimePlayers(playerIds: string[], gameMap: GameMap): Player[] {
        const spawnPositions = gameMap.objects
            .filter((object) => object.type === ObjectType.START)
            .map((object) => ({ ...object.position }));
        const walkablePositions = gameMap.map
            .filter((cell) => cell.isWalkable)
            .map((cell) => ({ ...cell.position }));

        return playerIds
            .map((playerId) => this.getPlayerById(playerId)?.player)
            .filter((player): player is Player => Boolean(player))
            .map((player, index) => ({
                ...player,
                information: { ...player.information },
                state: {
                    ...player.state,
                    position: this.getInitialPosition(index, spawnPositions, walkablePositions),
                    status: PlayerStatus.Active,
                    remainingActions: DEFAULT_ACTIONS_PER_TURN,
                    remainingMovements: player.state.attributes.speed,
                },
                render: {
                    ...player.render,
                    facing: player.render.facing ?? PlayerFacing.Front,
                    pose: player.render.pose ?? PlayerPose.Idle,
                },
            }));
    }

    /**
     * TODO: Sets the initiale player status according to its attributes
     * CURRENTLY HAVE DUMMY VALUES
     * @param information 
     */
    private setPlayerInitialState(): PlayerState {
        const state: PlayerState = {
            position: { x: 0, y: 0 },
            status: PlayerStatus.Active,
            attributes: {
                health: 0,
                maxHealth: 0,
                speed: 0,
                attack: 0,
                defense: 0,
            },
            wins: 0,
            remainingActions: 3,
            remainingMovements: 3,
        };
        return state;
    }

    private setPlayerInitialRenderState(): PlayerRenderState {
        const render: PlayerRenderState = {
            facing: PlayerFacing.Front,
            pose: PlayerPose.Idle,
        };
        return render;
    }

    private getInitialPosition(
        index: number,
        spawnPositions: { x: number; y: number }[],
        walkablePositions: GameCell['position'][],
    ): GameCell['position'] {
        return (
            spawnPositions[index] ??
            walkablePositions[index] ??
            walkablePositions[0] ??
            { x: 0, y: 0 }
        );
    }
}
