
import { isPlayerOnIce } from '@app/services/game-session/game-session.match';
import { canStartCombat } from '@app/services/game-session/game-session.runtime';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { clearTurnState } from '@app/services/timer/turn.timers';
import { BONUS, MIN_DIE_VALUE, NO_BONUS } from '@app/utilities/combat/combat.constants';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import { CombatSession, CombatStartPayload, Fighter } from '@app/utilities/combat/combat.interface';
import { CombatTimeoutPayload } from '@app/utilities/combat/combat.types';
import { Die, DIE_D4_SIDES, DIE_D6_SIDES } from '@common/character/character.model';
import { CombatPlayerStatistics, FighterStance } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CombatTurnService } from './combat-turn.service';

@Injectable()
export class CombatService {
    private readonly combatSessions = new Map<string, CombatSession>();
    constructor(
        private readonly gameSessionService: GameSessionService,
        private readonly turnService: CombatTurnService,
        private readonly event: EventEmitter2,
    ){}

    @OnEvent(CombatEvents.Timeout)
    handleTurnTimeout(payload: CombatTimeoutPayload): void {
        const session = this.combatSessions.get(payload.combatId);
        if (!session) return;
        this.combatTurn(payload.combatId, payload.playerId, null);
    };

    handleDisconnect(playerId: string): void {
        const combat = this.getCombatFromPlayer(playerId);
        if(!combat)
            return;
        this.endCombat(combat.id);
        const opponent = combat.players.find((player) => player.stats.id !== playerId);
        const session = this.gameSessionService.getSessionById(combat.gameSessionId);
        if(!session || !opponent)
            return ;
        const gameOpponent = session.match.players.find((fighter) => fighter.id === opponent.stats.id);
        gameOpponent.combatWins += 1;
        this.emitCombatResultSnapshot(CombatEvents.ClientDisconnect, combat, opponent.stats.id, playerId);
    };

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

    getCombatSession(combatId: string): CombatSession | undefined {
        return this.combatSessions.get(combatId);
    }

    createCombatSession(attackerId: string, defenderId: string, gameSessionId: string): CombatStartPayload | null {
        const game = this.gameSessionService.getSessionById(gameSessionId);

        if (!game || game.turnState.phase !== 'active' || 
            game.turnState.activePlayerId !== attackerId || 
            game.match.endState ||  game.turnState.actionTaken ||
            game.match.pendingSanctuaryChoice) {
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
            round: 1,
            players: [player1, player2],
            turnState,
            transitionTimeoutId: null,
            activeTurnTimeoutId: null,
            timerIntervalId: null,
        };
        this.combatSessions.set(session.id, session);
        return { combat: session, game };
    }
    
    startCombat(session: CombatSession): void {
        this.turnService.startTransition(session);
    }

    endCombat(sessionId: string): void {
        const session = this.combatSessions.get(sessionId);
        if(session){
            clearTurnState(session);
            this.combatSessions.delete(session.id);
        }
    }

    combatTurn(sessionId: string, playerId: string, stance: FighterStance): boolean {
        const session = this.combatSessions.get(sessionId);
        if(!session)
            return false;
        if(!this.setCombatStance(session, playerId, stance))
            return false;

        const currentPlayer = session.players.find(p => p.stats.id === playerId);
        const otherPlayer = session.players.find(p => p.stats.id !== playerId);

        if(currentPlayer.hasSelectedStance && otherPlayer.hasSelectedStance){
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

        if(currentPlayer.stats.health > NO_BONUS && otherPlayer.stats.health === NO_BONUS){
            this.emitCombatStatistics(session.id, attacks);
            this.emitCombatResultSnapshot(CombatEvents.Victory, session, currentPlayer.stats.id, otherPlayer.stats.id);
            this.gameSessionService.endCombat(session.gameSessionId, currentPlayer.stats.id, otherPlayer.stats.id);
            this.endCombat(session.id);
        } else if (otherPlayer.stats.health > NO_BONUS && currentPlayer.stats.health === NO_BONUS){
            this.emitCombatStatistics(session.id, attacks);
            this.emitCombatResultSnapshot(CombatEvents.Victory, session, otherPlayer.stats.id, currentPlayer.stats.id);
            this.gameSessionService.endCombat(session.gameSessionId, otherPlayer.stats.id, currentPlayer.stats.id);
            this.endCombat(session.id);
        } else if (otherPlayer.stats.health === NO_BONUS && currentPlayer.stats.health === NO_BONUS){
            this.emitCombatStatistics(session.id, attacks);
            this.emitCombatResultSnapshot(CombatEvents.Tie, session, currentPlayer.stats.id, otherPlayer.stats.id);
            this.gameSessionService.resolveCombatTie(session.gameSessionId, currentPlayer.stats.id, otherPlayer.stats.id);
            this.endCombat(session.id);
        } else {
            const isStanceSet1 = this.clearCombatStance(session, currentPlayer.stats.id);
            const isStanceSet2 = this.clearCombatStance(session, otherPlayer.stats.id);

            if(!isStanceSet1 || !isStanceSet2)
                return false;

            session.round += 1;
            this.emitCombatStatistics(session.id, attacks);
            return this.switchCombatTurn(session, currentPlayer.stats.id);
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
            hasSelectedStance: false,
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
        const attackRoll = this.getDieRoll(session, attacker);
        const defenseRoll = this.getDieRoll(session, defender);

        const stanceAttackBonus = attacker.combatStance === 'attack' ? BONUS : NO_BONUS;
        const stanceDefenseBonus = defender.combatStance === 'defense' ? BONUS : NO_BONUS;
        const sanctuaryAttackBonus = attacker.stats.attackBonus ?? NO_BONUS;
        const sanctuaryDefenseBonus = defender.stats.defenseBonus ?? NO_BONUS;

        const attackerIcePenalty = isAttackerOnIce ? BONUS : NO_BONUS;
        const defenderIcePenalty = isDefenderOnIce ? BONUS : NO_BONUS;

        const totalAttack = attacker.stats.baseAttack + sanctuaryAttackBonus + attackRoll + stanceAttackBonus - attackerIcePenalty;
        const totalDefense = defender.stats.baseDefense + sanctuaryDefenseBonus + defenseRoll + stanceDefenseBonus - defenderIcePenalty;

        const damage = totalAttack - totalDefense;

        let victim = defender;

        if(damage > NO_BONUS){
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
        player.hasSelectedStance = true;
        return true;
    }

    private clearCombatStance(session: CombatSession, playerId: string): boolean {
        const player = session.players.find((candidate) => candidate.stats.id === playerId);
        if (!player) {
            return false;
        }

        player.combatStance = null;
        player.hasSelectedStance = false;
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

    private emitCombatStatistics(combatId: string, statistics: CombatPlayerStatistics[]): void {
        this.event.emit(CombatEvents.Statistics, { combatId, statistics });
    }

    private rollDie(die: Die): number {
        if(die === 'D4')
            return Math.floor(Math.random() * DIE_D4_SIDES) + 1;
        else
            return Math.floor(Math.random() * DIE_D6_SIDES) + 1;
    }

    private getDieRoll(session: CombatSession, player: Fighter): number {
        if (!this.isDebugModeEnabled(session)) {
            return this.rollDie(player.stats.attackDie);
        }

        return this.isCombatInstigator(session, player.stats.id) ? this.getMaxRoll(player.stats.attackDie) : MIN_DIE_VALUE;
    }

    private isDebugModeEnabled(session: CombatSession): boolean {
        return !!this.gameSessionService.getMatchFromSessionId(session.gameSessionId)?.debugMode;
    }

    private isCombatInstigator(session: CombatSession, playerId: string): boolean {
        return session.players[0]?.stats.id === playerId;
    }

    private getMaxRoll(die: Die): number {
        return die === 'D4' ? DIE_D4_SIDES : DIE_D6_SIDES;
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
}
