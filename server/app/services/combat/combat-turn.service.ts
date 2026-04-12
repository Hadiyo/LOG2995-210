import { initTurnState } from '@app/services/game-session/game-session.runtime';
import { activateTurn, advanceToNextTurn, startTimerTransition } from '@app/services/timer/turn.timers';
import { ACTIVE_COMBAT_TURN_DURATION_MS, COMBAT_TRANSITION_DURATION_MS } from '@app/utilities/combat/combat.constants';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import { CombatSession } from '@app/utilities/combat/combat.interface';
import { TimerConfig } from '@app/utilities/turn/turn.type';
import { MatchPlayer } from '@common/game/match.interface';
import { MatchTurnOrderEntry, MatchTurnState } from '@common/game/turn.interface';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CombatTurnService {
    private readonly startTimerConfig: TimerConfig<CombatSession> = {
        emitSnapshot: (session) => this.emitTurnSnapshot(session),
        onTransitionEnd: (session) => this.activateTurn(session),
        transitionDuration: COMBAT_TRANSITION_DURATION_MS,
    };

    private readonly activateTurnConfig: TimerConfig<CombatSession> = {
        emitSnapshot: (session) => this.emitTurnSnapshot(session),
        onTransitionEnd: (session) => this.advanceToNextTurn(session),
        transitionDuration: ACTIVE_COMBAT_TURN_DURATION_MS,
    };
    
    constructor(private readonly event: EventEmitter2){
        this.emitTurnSnapshot = this.emitTurnSnapshot.bind(this);
    }
    
    startTransition(session: CombatSession): void {
        startTimerTransition(session, this.startTimerConfig);
    }

    advanceToNextTurn(session: CombatSession): void {
        advanceToNextTurn(session);
        this.startTransition(session);
    }

    initCombatTurnState(id: string, attacker: MatchPlayer, defender: MatchPlayer): MatchTurnState {
        const order: MatchTurnOrderEntry[] = [{ playerId: attacker.id, speed: attacker.speed}, { playerId: defender.id, speed: defender.speed}];
        const firstPlayerId = order[0]?.playerId ?? null;
        const turnState = initTurnState(id, firstPlayerId, COMBAT_TRANSITION_DURATION_MS, order);
        return turnState;
    }

    private activateTurn(session: CombatSession): void {
        activateTurn(session, this.getActivePlayer, this.activateTurnConfig);
    }

    private getActivePlayer(session: CombatSession): MatchPlayer | null {
        const activePlayerId = session.turnState.order[session.turnState.currentTurnIndex]?.playerId ?? null;
        if(activePlayerId)
            return null;
        const activePlayer = session.players.find((player) => player.stats.id === activePlayerId) ?? null;
        if (!activePlayer) {
            return null;
        }
        return activePlayer.stats;
    }

    private emitTurnSnapshot(session: CombatSession): void {
        this.event.emit(CombatEvents.Turn, {
            combatId: session.id,
            gameSessionId: session.gameSessionId,
            attackerId: session.players[0]?.stats.id ?? '',
            defenderId: session.players[1]?.stats.id ?? '',
            round: session.round,
            turnState: session.turnState,
        });
    }
}
