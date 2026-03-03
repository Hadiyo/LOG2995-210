import { GameSession } from '@common/game/game-session.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionService {
    /** HOLDS ALL GAME AND COMBAT SESSIONS WITH REFERENCES TO THE GAME-MAP TEMPLATES AND PLAYERS */
    private gameSessions = new Map<string, GameSession>();

    getGameSessionById(id: string): GameSession {
        return this.gameSessions.get(id);
    }
}
