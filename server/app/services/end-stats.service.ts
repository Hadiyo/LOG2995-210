import { EndStats, PlayerStats } from '@common/game-session';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import { Vec2 } from '@common/maps/map.interface';
import { Injectable } from '@nestjs/common';
import { MapService } from './map/map.service';

@Injectable()
export class EndStatsService {
    readonly sessions: Map<string, EndStats> = new Map<string, EndStats>();   
    
    constructor(
        private readonly mapService: MapService,
    ) {}

    async startGame(sessionId: string, mapId: string, playerList: MatchLobbyPlayer[]): Promise<void> {
        const playerStats: PlayerStats[] = [];

        for (const player of playerList) {
            playerStats.push({
                id: player.id,
                name: player.name,
                combats: 0,
                victories: 0,
                defeats: 0,
                damageTaken: 0,
                damageDealt: 0,
                percentTiles: 0,
            });
        }

        const map = await this.mapService.getMapByIdForEditor(mapId);

        const emptyNewStats: EndStats = {
            startTime: new Date(),
            endTime: null,
            turns: 1,
            usedSanctuaries: [],
            totalSanctuaries: map.objects.filter((obj) => [ObjectType.ARENA, ObjectType.REGEN].includes(obj.type)).length,
            usedDoors: [],
            totalDoors: map.map.filter((tile) => tile.tileType === TileType.DOOR).length,
            visitedTiles: [],
            totalTiles: map.mapsize * map.mapsize,
            playerStats,
            heldFlag: map.mode === GameMode.CTF ? [] : undefined,
        };

        this.sessions.set(sessionId, emptyNewStats); 
    }

    endGame(sessionId: string): EndStats {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.endTime = new Date();
        }

        return session;
    }

    endTurn(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.turns += 1;
        }
    }

    startCombat(sessionId: string, attackerId: string, defenderId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            const attacker = session.playerStats.find((player) => player.id === attackerId);
            const defender = session.playerStats.find((player) => player.id === defenderId);
            if (attacker && defender) {
                attacker.combats += 1;
                defender.combats += 1;
            }
        }
    }

    useSanctuary(sessionId: string, sanctuaryId: number): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (!session.usedSanctuaries.includes(sanctuaryId)) {
                session.usedSanctuaries.push(sanctuaryId);
            }
        }
    }

    visitTile(sessionId: string, tilePosition: Vec2, playerId: string): void {
        const session = this.sessions.get(sessionId);
        const tileKey = `${tilePosition.x},${tilePosition.y}`;
        if (session) {
            const targetTile = session.visitedTiles.find((tile) => {
                return tile.position === tileKey;
            });
            if (!targetTile) {
                session.visitedTiles.push({ position: tileKey, players: [playerId] });
            } else if (!targetTile.players.includes(playerId)) {
                targetTile.players.push(playerId);
            }
        }
    }

    useDoor(sessionId: string, doorPosition: Vec2): void {
        const session = this.sessions.get(sessionId);
        const door = `${doorPosition.x},${doorPosition.y}`;
        if (session) {
            if (!session.usedDoors.includes(door)) {
                session.usedDoors.push(door);
            }
        }
    }

    getFlag(sessionId: string, playerId: string): void {
        const session = this.sessions.get(sessionId);
        if (session && !session.heldFlag.includes(playerId)) {
            session.heldFlag.push(playerId);
        }
    }

    takeDamage(sessionId: string, playerId: string, damage: number): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            const player = session.playerStats.find((p) => p.id === playerId);
            if (player) {
                player.damageTaken += damage;
            }
        }
    }

    dealDamage(sessionId: string, playerId: string, damage: number): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            const player = session.playerStats.find((p) => p.id === playerId);
            if (player) {
                player.damageDealt += damage;
            }
        }
    }

    resultCombat(sessionId: string, winnerId: string, loserId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            const winner = session.playerStats.find((p) => p.id === winnerId);
            const loser = session.playerStats.find((p) => p.id === loserId);
            if (winner && loser) {
                winner.victories += 1;
                loser.defeats += 1;
            }
        }
    }

    endSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }
}