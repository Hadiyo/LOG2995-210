import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CombatRoundBreakdown, CombatRoundLog } from '@app/services/match/combat-state.models';
import { CombatRoundOutcome } from '@common/combat/combat.interface';

@Component({
    selector: 'app-game-combat-round-log-fighter',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-combat-round-log-fighter.component.html',
    styleUrl: './game-combat-round-log-fighter.component.scss',
})
export class GameCombatRoundLogFighterComponent {
    @Input({ required: true }) fighter!: CombatRoundLog['fighters'][number];
    @Input({ required: true }) outcome!: CombatRoundOutcome;
    @Input({ required: true }) attackSucceeded!: boolean | null;
    @Input({ required: true }) defenseSucceeded!: boolean | null;
    @Input({ required: true }) stanceLabel!: string;
    @Input({ required: true }) resultLabel!: string;
    @Input({ required: true }) damageLabel!: string;

    protected dieClass(dieType: CombatRoundBreakdown['dieType']): string {
        return dieType === 'D6' ? 'combat-round-log__die--d6' : 'combat-round-log__die--d4';
    }

    protected signedValue(value: number): string {
        return value > 0 ? `+${value}` : `${value}`;
    }

    protected displayValue(value: number | null): string {
        return value === null ? '--' : `${value}`;
    }

    protected breakdownTotal(breakdown: CombatRoundBreakdown): string {
        return breakdown.total === null ? '--' : `${breakdown.total}`;
    }
}