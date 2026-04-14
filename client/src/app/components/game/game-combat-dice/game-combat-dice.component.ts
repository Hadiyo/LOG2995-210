import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { COMBAT_DICE_ROLL_DURATION_MS, COMBAT_DICE_ROLL_FRAME_INTERVAL_MS } from '@app/services/match/combat-state.constants';
import { DIE_D4_SIDES, DIE_D6_SIDES, Die } from '@common/character/character.model';

@Component({
    selector: 'app-game-combat-dice',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-combat-dice.component.html',
    styleUrl: './game-combat-dice.component.scss',
})
export class GameCombatDiceComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) attackDie!: Die;
    @Input({ required: true }) defenseDie!: Die;
    @Input() attackValue: number | null = null;
    @Input() defenseValue: number | null = null;
    @Input() rollToken = 0;
    @Input() side: 'left' | 'right' = 'left';

    protected attackDisplay = '--';
    protected defenseDisplay = '--';
    protected isRolling = false;

    private settleTimeoutId: number | null = null;
    private rollingIntervalId: number | null = null;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.rollToken && !changes.rollToken.firstChange && (this.attackValue !== null || this.defenseValue !== null)) {
            this.startRollingAnimation();
            return;
        }

        this.syncDisplayedValues();
    }

    ngOnDestroy(): void {
        this.clearAnimationTimers();
    }

    protected getDieShapeClass(die: Die): string {
        return die === 'D4' ? 'combat-dice__die--d4' : 'combat-dice__die--d6';
    }

    protected getDieColorClass(die: Die): string {
        return die === 'D4' ? 'combat-dice__die--blue' : 'combat-dice__die--green';
    }

    protected dieAriaLabel(die: Die, value: number | null): string {
        return value === null ? die : `${die} ${value}`;
    }

    private startRollingAnimation(): void {
        this.clearAnimationTimers();
        this.isRolling = true;
        this.rollingIntervalId = window.setInterval(() => {
            this.attackDisplay = `${this.randomDieValue(this.attackDie)}`;
            this.defenseDisplay = `${this.randomDieValue(this.defenseDie)}`;
        }, COMBAT_DICE_ROLL_FRAME_INTERVAL_MS);

        this.settleTimeoutId = window.setTimeout(() => {
            this.isRolling = false;
            this.syncDisplayedValues();
            this.clearAnimationTimers();
        }, COMBAT_DICE_ROLL_DURATION_MS);
    }

    private syncDisplayedValues(): void {
        this.attackDisplay = this.attackValue === null ? this.attackDie : `${this.attackValue}`;
        this.defenseDisplay = this.defenseValue === null ? this.defenseDie : `${this.defenseValue}`;
    }

    private clearAnimationTimers(): void {
        if (this.rollingIntervalId) {
            window.clearInterval(this.rollingIntervalId);
            this.rollingIntervalId = null;
        }
        if (this.settleTimeoutId) {
            window.clearTimeout(this.settleTimeoutId);
            this.settleTimeoutId = null;
        }
    }

    private randomDieValue(die: Die): number {
        const sides = die === 'D4' ? DIE_D4_SIDES : DIE_D6_SIDES;
        return Math.floor(Math.random() * sides) + 1;
    }
}
