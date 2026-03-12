import { InternalPlayer } from '@app/interface/player.interface';
import { Player, PlayerInformation, PlayerRenderState, PlayerState, PlayerStatus } from '@common/player/player.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

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
            facing: 'front',
            pose: 'idle',
        };
        return render;
    }
}
