import { Injectable, signal } from '@angular/core';
import { generateClientId } from '@app/utils/id.util';
import { MatchPlayer } from '@common/game/match.interface';
import { manhattanDistance } from './match-geometry';
import { MatchStateService } from './match-state.service';
import { TurnStateService } from './turn-state.service';

export interface CombatOutcomeNotice {
    id: string;
    attackerId: string;
    defenderId: string;
    attackerMessage: string;
    defenderMessage: string;
    logMessage: string;
}

@Injectable({ providedIn: 'root' })
export class CombatStateService {
    readonly lastCombatUpdate = signal('');
    readonly lastCombatOutcome = signal<CombatOutcomeNotice | null>(null);

    constructor(
        private readonly matchStateService: MatchStateService,
        private readonly turnStateService: TurnStateService,
    ) {}

    startCombat(attackerId: string, defenderId: string): boolean {
        const match = this.matchStateService.match();
        const turnState = this.turnStateService.turnState();
        if (!match || match.endState || !turnState || turnState.phase !== 'active') {
            return false;
        }

        const attacker = match.players.find((player) => player.id === attackerId) ?? null;
        const defender = match.players.find((player) => player.id === defenderId) ?? null;
        if (!attacker || !defender || manhattanDistance(attacker.position, defender.position) !== 1) {
            return false;
        }

        if (!this.turnStateService.consumeAction(attackerId)) {
            return false;
        }

        const aftermath = this.matchStateService.applyCombatAftermath([defender.id]);
        const outcome = this.createImmediateVictoryNotice(attacker, defender, aftermath);
        this.lastCombatUpdate.set(outcome.logMessage);
        this.lastCombatOutcome.set(outcome);

        this.matchStateService.registerCombatVictory(attacker.id);

        return true;
    }

    private createImmediateVictoryNotice(
        attacker: MatchPlayer,
        defender: MatchPlayer,
        aftermath: ReturnType<MatchStateService['applyCombatAftermath']>,
    ): CombatOutcomeNotice {
        const defenderRespawn = aftermath?.respawnedPlayers.find((entry) => entry.playerId === defender.id)?.position ?? null;
        const respawnMessage = defenderRespawn
            ? ` ${defender.name} reapparait en (${defenderRespawn.x}, ${defenderRespawn.y}).`
            : '';

        return {
            id: generateClientId(),
            attackerId: attacker.id,
            defenderId: defender.id,
            attackerMessage: `Victoire contre ${defender.name}.`,
            defenderMessage: `Defaite contre ${attacker.name}.${respawnMessage}`.trim(),
            logMessage: `Combat termine: ${attacker.name} gagne contre ${defender.name}.${respawnMessage}`.trim(),
        };
    }
}
