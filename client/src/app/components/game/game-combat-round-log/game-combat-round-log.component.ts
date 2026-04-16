import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NEUTRAL_COMBAT_VALUE } from '@app/services/match/combat-state.constants';
import {
    COMBAT_FIGHTER_INDEXES,
    CombatFighterIndex,
    CombatRoundBreakdown,
    CombatRoundLog,
    CombatStanceChoice,
} from '@app/services/match/combat-state.models';
import { CombatRoundOutcome } from '@common/combat/combat.interface';
import { GameCombatRoundLogFighterComponent } from './game-combat-round-log-fighter.component';

@Component({
    selector: 'app-game-combat-round-log',
    standalone: true,
    imports: [CommonModule, GameCombatRoundLogFighterComponent],
    templateUrl: './game-combat-round-log.component.html',
    styleUrl: './game-combat-round-log.component.scss',
})
export class GameCombatRoundLogComponent implements OnChanges {
    @Input({ required: true }) logs: readonly CombatRoundLog[] = [];

    protected displayedLogs: readonly CombatRoundLog[] = [];

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.logs) {
            this.displayedLogs = [...this.logs].reverse();
        }
    }

    protected stanceLabel(stance: CombatStanceChoice): string {
        if (stance === 'attack') {
            return 'Offensive';
        }

        if (stance === 'defense') {
            return 'Défensive';
        }

        return 'Aucune';
    }

    protected combatFighterIndex(index: number): CombatFighterIndex {
        const [firstCombatFighterIndex] = COMBAT_FIGHTER_INDEXES;
        return COMBAT_FIGHTER_INDEXES.find((fighterIndex) => fighterIndex === index) ?? firstCombatFighterIndex;
    }

    protected fighterOutcome(round: CombatRoundLog, fighterIndex: CombatFighterIndex): CombatRoundOutcome {
        if (!this.isResolved(round)) {
            return 'pending';
        }

        const fighter = round.fighters[fighterIndex];
        const opponent = this.getOpponentFighter(round, fighterIndex);
        const fighterDamage = fighter.damage ?? NEUTRAL_COMBAT_VALUE;
        const opponentDamage = opponent.damage ?? NEUTRAL_COMBAT_VALUE;

        if (fighterDamage > opponentDamage) {
            return 'win';
        }

        if (fighterDamage < opponentDamage) {
            return 'lose';
        }

        return 'draw';
    }

    protected attackSucceeded(round: CombatRoundLog, fighterIndex: CombatFighterIndex): boolean | null {
        if (!this.isResolved(round)) {
            return null;
        }

        return (round.fighters[fighterIndex].attackDelta ?? NEUTRAL_COMBAT_VALUE) > NEUTRAL_COMBAT_VALUE;
    }

    protected defenseSucceeded(round: CombatRoundLog, fighterIndex: CombatFighterIndex): boolean | null {
        if (!this.isResolved(round)) {
            return null;
        }

        return (this.getOpponentFighter(round, fighterIndex).attackDelta ?? NEUTRAL_COMBAT_VALUE) <= NEUTRAL_COMBAT_VALUE;
    }

    protected signedValue(value: number): string {
        if (value > NEUTRAL_COMBAT_VALUE) {
            return `+${value}`;
        }

        return `${value}`;
    }

    protected displayValue(value: number | null): string {
        return value === null ? '--' : `${value}`;
    }

    protected breakdownTotal(breakdown: CombatRoundBreakdown): string {
        return breakdown.total === null ? '--' : `${breakdown.total}`;
    }

    protected resultLabel(round: CombatRoundLog, fighterIndex: CombatFighterIndex): string {
        const fighter = round.fighters[fighterIndex];
        if (fighter.damage === null || fighter.attackDelta === null) {
            return 'En attente du lancer';
        }

        if (fighter.damage > NEUTRAL_COMBAT_VALUE) {
            return `Diff ${this.signedValue(fighter.attackDelta)} | Dégâts ${fighter.damage}`;
        }

        return `Diff ${this.signedValue(fighter.attackDelta)} | Aucun dégât`;
    }

    protected damageLabel(round: CombatRoundLog, fighterIndex: CombatFighterIndex): string {
        const fighter = round.fighters[fighterIndex];
        if (fighter.damage === null) {
            return 'Dégâts --';
        }

        return fighter.damage > NEUTRAL_COMBAT_VALUE ? `Dégâts ${fighter.damage}` : 'Aucun dégât';
    }

    protected isResolved(round: CombatRoundLog): boolean {
        return round.status === 'resolved';
    }

    private getOpponentFighter(round: CombatRoundLog, fighterIndex: CombatFighterIndex): CombatRoundLog['fighters'][number] {
        return round.fighters.find((_fighter, index) => index !== fighterIndex) ?? round.fighters[fighterIndex];
    }
}
