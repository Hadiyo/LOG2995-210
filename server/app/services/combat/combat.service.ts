
import { isPlayerOnIce } from '@app/services/game-session/game-session.match';
import { canStartCombat } from '@app/services/game-session/game-session.runtime';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { clearGameSessionTimers } from '@app/services/game-session/game-session.timers';
import { BONUS, MIN_DIE_VALUE, ZERO } from '@app/utilities/combat/combat.constants';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import { CombatSession, Fighter } from '@app/utilities/combat/combat.interface';
import { Die, DIE_D4_SIDES, DIE_D6_SIDES } from '@common/character/character.model';
import { CombatPlayerStatistics, FighterStance } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { SessionSocketEvents } from '@common/socket-events';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CombatTurnService } from './combat-turn.service';

@Injectable()
export class CombatService implements OnModuleInit, OnModuleDestroy {
    private readonly combatSessions = new Map<string, CombatSession>();
    private readonly event = new EventEmitter2();
    constructor(
        private readonly gameSessionService: GameSessionService,
        private readonly turnService: CombatTurnService,
    ){}

    onModuleInit() {
        this.gameSessionService.on(SessionSocketEvents.ClientDisconnect, this.handleDisconnect);
    }

    onModuleDestroy() {
        this.gameSessionService.off(SessionSocketEvents.ClientDisconnect, this.handleDisconnect);
    }

    getCombatIdByRooms(rooms: string[]): string | undefined {
        return rooms.find((room) => this.combatSessions.has(room));
    }

    getCombatFromPlayer(playerId: string): CombatSession {
        for (const session of this.combatSessions.values()) {
            if (session.players.some(player => player.stats.id === playerId)) {
                return session;
            }
        }
        return undefined;
    }

    createCombatSession(attackerId: string, defenderId: string, gameSessionId: string): CombatSession | null {
        const game = this.gameSessionService.getSessionById(gameSessionId);

        if (!game || game.turnState.phase !== 'active' || game.turnState.activePlayerId !== attackerId || game.match.endState) {
            return null;
        }

        const player1 = this.createFighter(game.match.players, attackerId);
        const player2 = this.createFighter(game.match.players, defenderId);

        if(!player1.stats || !player2.stats)
            return null;

        if(!canStartCombat(player1.stats, player2.stats))
            return null;
        
        const newId = crypto.randomUUID();
        const turnState = this.turnService.initCombatTurnState(newId, player1.stats, player2.stats);
        const session: CombatSession = {
            id: newId,
            gameSessionId,
            players: [player1, player2],
            turnState,
            transitionTimeoutId: null,
            activeTurnTimeoutId: null,
            timerIntervalId: null,
        };
        this.combatSessions.set(session.id, session);
        return session;
    }
    
    startCombat(session: CombatSession): void {
        this.turnService.startTransition(session);
    }

    endCombat(sessionId: string): void {
        const session = this.combatSessions.get(sessionId);
        if(session){
            clearGameSessionTimers(session);
            session.turnState = {
                ...session.turnState,
                phase: 'transition',
                activePlayerId: null,
                transitionTargetPlayerId: null,
                transitionEndsAt: null,
                transitionRemainingMs: 0,
                activeTurnEndsAt: null,
                activeTurnRemainingMs: 0,
                movementPointsRemaining: 0,
                actionTaken: true,
            };
            this.combatSessions.delete(session.id);
        }
    }

    combatTurn(sessionId: string, playerId: string, stance: FighterStance): boolean {
        const session = this.combatSessions.get(sessionId);

        if(!this.setCombatStance(session, playerId, stance))
            return false;

        const currentPlayer = session.players.find(p => p.stats.id === playerId);
        const otherPlayer = session.players.find(p => p.stats.id !== playerId);

        if(currentPlayer.combatStance && otherPlayer.combatStance){
            const isCurrPlayerOnIce = this.isFighterOnIce(session.gameSessionId, currentPlayer.stats.id);
            const isOtherPlayerOnIce = this.isFighterOnIce(session.gameSessionId, otherPlayer.stats.id);

            const attack1 = this.attack(session, currentPlayer, isCurrPlayerOnIce, otherPlayer, isOtherPlayerOnIce);
            const attack2 = this.attack(session, otherPlayer,isOtherPlayerOnIce, currentPlayer, isCurrPlayerOnIce);
            
            return this.evaluateCombatResult(session, [attack1, attack2]);
        } else {
            return this.switchCombatTurn(session, currentPlayer.stats.id);
        }
    }

    evaluateCombatResult(session: CombatSession, attacks: CombatPlayerStatistics[]): boolean {
        if(!session || !attacks[0] || !attacks[1])
            return false;

        const currentPlayer = session.players.find(p => p.stats.id === attacks[0].attacker.id);
        const otherPlayer = session.players.find(p => p.stats.id === attacks[1].attacker.id);

        if(currentPlayer.stats.health > ZERO && otherPlayer.stats.health === ZERO){
            this.gameSessionService.endCombat(session.gameSessionId, currentPlayer.stats.id, otherPlayer.stats.id);
            this.emitCombatResultSnapshot(CombatEvents.Victory, session, currentPlayer.stats.id, otherPlayer.stats.id);
            this.endCombat(session.id);
        } else if (otherPlayer.stats.health > ZERO && currentPlayer.stats.health === ZERO){
            this.gameSessionService.endCombat(session.gameSessionId, otherPlayer.stats.id, currentPlayer.stats.id);
            this.emitCombatResultSnapshot(CombatEvents.Victory, session, otherPlayer.stats.id, currentPlayer.stats.id);
            this.endCombat(session.id);
        } else if (otherPlayer.stats.health === ZERO && currentPlayer.stats.health === ZERO){
            this.emitCombatResultSnapshot(CombatEvents.Tie, session, currentPlayer.stats.id, otherPlayer.stats.id);
            this.endCombat(session.id);
        } else {
            const isStanceSet1 = this.setCombatStance(session, currentPlayer.stats.id, null);
            const isStanceSet2 = this.setCombatStance(session, otherPlayer.stats.id, null);

            if(!isStanceSet1 || !isStanceSet2)
                return false;

            this.switchCombatTurn(session, currentPlayer.stats.id);
            this.event.emit(CombatEvents.Statistics, { combatId: session.id, statistics: attacks });
        }
        return true;
    }

    switchCombatTurn(session: CombatSession, playerId: string): boolean {
        if (!session || session.turnState.phase !== 'active' || session.turnState.activePlayerId !== playerId) {
            return false;
        }
        this.turnService.advanceToNextTurn(session);
        return true;
    }

    private createFighter(players: MatchPlayer[], playerId: string): Fighter {
        const player = players.find((candidate) => candidate.id === playerId);
        return {
            stats: player,
            combatStance: null,
            hasPenalty: false,
        };
    }

    private attack(
        session: CombatSession, 
        attacker: Fighter, 
        isAttackerOnIce: boolean, 
        defender: Fighter,
        isDefenderOnIce: boolean,
    ): CombatPlayerStatistics {
        let attackRoll = 0;
        let defenseRoll = 0;

        if(this.gameSessionService.getMatchFromSessionId(session.id)?.debugMode){
            attackRoll = attacker.stats.attackDie === 'D4' ? DIE_D4_SIDES : DIE_D6_SIDES;
            defenseRoll = MIN_DIE_VALUE;
        } else {
            attackRoll = this.rollDie(attacker.stats.attackDie);
            defenseRoll = this.rollDie(defender.stats.defenseDie);
        }

        const attackBonus = attacker.combatStance === 'attack' ? BONUS : ZERO;
        const defenseBonus = defender.combatStance === 'defense' ? BONUS : ZERO;

        const attackerIcePenalty = isAttackerOnIce ? BONUS : ZERO;
        const defenderIcePenalty = isDefenderOnIce ? BONUS : ZERO;

        const totalAttack = attacker.stats.baseAttack + attackRoll + attackBonus - attackerIcePenalty;
        const totalDefense = defender.stats.baseDefense + defenseRoll + defenseBonus - defenderIcePenalty;

        const damage = totalAttack - totalDefense;

        let victim = defender;

        if(damage >= 0){
            victim = this.updatePlayerHealth(session.id, defender.stats.id, damage);
            if(!victim) victim = defender;
        }
        
        return {
            attacker: { id: attacker.stats.id, health: attacker.stats.health },
            victim: { id: victim.stats.id, health: victim.stats.health },
            attackRoll,
            defenseRoll,
            attack: totalAttack,
            defense: totalDefense,
        };
    }

    private setCombatStance(session: CombatSession, playerId: string, stance: FighterStance): boolean {
        if (!session || session.turnState.phase !== 'active' || session.turnState.activePlayerId !== playerId) {
            return false;
        }
        const player = session.players.find(p => p.stats.id === playerId);
        if(!player)
            return false;
        player.combatStance = stance;
        return true;
    }

    private emitCombatResultSnapshot(event: CombatEvents, session: CombatSession, winner: string, loser: string): void {
        // CombatResultSnapshot
        this.event.emit(event, {
            combatId: session.id,
            gameSessionId: session.gameSessionId,
            winner,
            loser,
        });
    }

    private rollDie(die: Die): number {
        if(die === 'D4')
            return Math.floor(Math.random() * DIE_D4_SIDES) + 1;
        else
            return Math.floor(Math.random() * DIE_D6_SIDES) + 1;
    }

    private isFighterOnIce(matchId: string, playerId: string): boolean {
        const match = this.gameSessionService.getMatchFromSessionId(matchId);
        if(!match)
            return false;
        return isPlayerOnIce(match, playerId);
    }

    private updatePlayerHealth(sessionId: string, playerId: string, damage: number): Fighter | undefined{
        const session = this.combatSessions.get(sessionId);
        if (!session) return;
        const player = session.players.find(p => p.stats.id === playerId);
        if(!player) return;
        player.stats.health = Math.max(player.stats.health - damage, 0);
        return player;
    }

    private handleDisconnect = (playerId: string) => {
        const combat = this.getCombatFromPlayer(playerId);
        if(!combat)
            return;
        const opponent = combat.players.find((player) => player.stats.id !== playerId);
        if(opponent){
            this.gameSessionService.setWinner(combat.gameSessionId, opponent.stats.id);
            this.emitCombatResultSnapshot(CombatEvents.ClientDisconnect, combat, opponent.stats.id, playerId);
        }
        this.endCombat(combat.id);
    };

}
