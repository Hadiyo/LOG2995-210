import { createActiveTurnState, createTransitionTurnState, initTurnState } from '@app/services/game-session/game-session.runtime';
import { clearGameSessionTimers, tickGameSessionTimers } from '@app/services/game-session/game-session.timers';
import { ACTIVE_COMBAT_TURN_DURATION_MS, COMBAT_TRANSITION_DURATION_MS } from '@app/utilities/combat/combat.constants';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import { CombatSession } from '@app/utilities/combat/combat.interface';
import { SNAPSHOT_TICK_MS } from '@app/utilities/game/game.constants';
import { MatchPlayer } from '@common/game/match.interface';
import { MatchTurnOrderEntry, MatchTurnState } from '@common/game/turn.interface';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CombatTurnService {
    constructor(private readonly event: EventEmitter2){}
    
    startTransition(session: CombatSession): void {
        clearGameSessionTimers(session);
        session.turnState = createTransitionTurnState(session.turnState);
        this.emitTurnSnapshot(session);
        session.timerIntervalId = setInterval(() => tickGameSessionTimers(session, 
            (candidate) => this.emitTurnSnapshot(candidate)), SNAPSHOT_TICK_MS);
        session.transitionTimeoutId = setTimeout(() => this.activateTurn(session), COMBAT_TRANSITION_DURATION_MS);
    }

    advanceToNextTurn(session: CombatSession): void {
        clearGameSessionTimers(session);
        if (session.turnState.order.length === 0) {
            return;
        }
        session.turnState = {
            ...session.turnState,
            currentTurnIndex: (session.turnState.currentTurnIndex + 1) % session.turnState.order.length,
        };
        this.startTransition(session);
    }

    initCombatTurnState(id: string, attacker: MatchPlayer, defender: MatchPlayer): MatchTurnState {
        const order: MatchTurnOrderEntry[] = [{ playerId: attacker.id, speed: attacker.speed}, { playerId: defender.id, speed: defender.speed}];
        const firstPlayerId = order[0]?.playerId ?? null;
        const turnState = initTurnState(id, firstPlayerId, COMBAT_TRANSITION_DURATION_MS, order);
        return turnState;
    }

    private activateTurn(session: CombatSession): void {
        const activePlayerId = session.turnState.order[session.turnState.currentTurnIndex]?.playerId ?? null;
        const activePlayer = session.players.find((player) => player.stats.id === activePlayerId) ?? null;
        if (!activePlayerId || !activePlayer) {
            return;
        }

        clearGameSessionTimers(session);
        session.turnState = createActiveTurnState(session.turnState, activePlayer.stats, ACTIVE_COMBAT_TURN_DURATION_MS);
        this.emitTurnSnapshot(session);
        session.timerIntervalId = setInterval(() => tickGameSessionTimers(session,
            (candidate) => this.emitTurnSnapshot(candidate)), SNAPSHOT_TICK_MS);
        session.activeTurnTimeoutId = setTimeout(() => this.advanceToNextTurn(session), ACTIVE_COMBAT_TURN_DURATION_MS);
    }

    private emitTurnSnapshot(session: CombatSession): void {
        // CombatTurnSnapshot
        this.event.emit(CombatEvents.Turn, {
            combatId: session.id,
            turnState: session.turnState,
        });
    }
}