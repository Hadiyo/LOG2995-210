import { Player, PlayerInformation, PlayerState } from '@common/player/player.interface';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';


@Injectable()
export class PlayerService {
    /** HOLD ALL PLAYERS AND THEIR REFERENCE TO THE GAME THEY ARE IN */
    private players = new Map<string, Player>();

    getPlayerById(id: string): Player {
        return this.players.get(id);
    }

    /**
     * Saves player input to the list of players and create a unique reference id
     * @returns the player unique id
     */
    savePlayer(info: PlayerInformation, clientId: string): string {
        const newPlayer: Player = {
            id: randomUUID(),
            socketId: clientId,
            information: info,
            state: this.setPlayerInitialState(),
        };

        this.players.set(newPlayer.id, newPlayer);
        return newPlayer.id;
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
            health: 4,
            wins: 0,
            remainingActions: 3,
            remainingMovements: 3,
        };

        return state;
    }

}
