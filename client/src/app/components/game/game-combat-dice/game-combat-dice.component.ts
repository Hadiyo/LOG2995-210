import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

type CombatDie = 'D4' | 'D6';
const D4_SIDES = 4;
const D6_SIDES = 6;
const ROLL_FRAME_INTERVAL_MS = 80;
const ROLL_DURATION_MS = 1000;

@Component({
    selector: 'app-game-combat-dice',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-combat-dice.component.html',
    styleUrl: './game-combat-dice.component.scss',
})
export class GameCombatDiceComponent implements OnChanges, OnDestroy {
    @Input({ required: true }) attackDie!: CombatDie;
    @Input({ required: true }) defenseDie!: CombatDie;
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

    protected getDieShapeClass(die: CombatDie): string {
        return die === 'D4' ? 'combat-dice__die--d4' : 'combat-dice__die--d6';
    }

    protected getDieColorClass(die: CombatDie): string {
        return die === 'D4' ? 'combat-dice__die--blue' : 'combat-dice__die--green';
    }

    protected dieAriaLabel(die: CombatDie, value: number | null): string {
        return value === null ? die : `${die} ${value}`;
    }

    private startRollingAnimation(): void {
        this.clearAnimationTimers();
        this.isRolling = true;
        this.rollingIntervalId = window.setInterval(() => {
            this.attackDisplay = `${this.randomDieValue(this.attackDie)}`;
            this.defenseDisplay = `${this.randomDieValue(this.defenseDie)}`;
        }, ROLL_FRAME_INTERVAL_MS);

        this.settleTimeoutId = window.setTimeout(() => {
            this.isRolling = false;
            this.syncDisplayedValues();
            this.clearAnimationTimers();
        }, ROLL_DURATION_MS);
    }

    private syncDisplayedValues(): void {
        this.attackDisplay = this.attackValue === null ? '--' : `${this.attackValue}`;
        this.defenseDisplay = this.defenseValue === null ? '--' : `${this.defenseValue}`;
    }

    private clearAnimationTimers(): void {
        if (this.rollingIntervalId !== null) {
            window.clearInterval(this.rollingIntervalId);
            this.rollingIntervalId = null;
        }
        if (this.settleTimeoutId !== null) {
            window.clearTimeout(this.settleTimeoutId);
            this.settleTimeoutId = null;
        }
    }

    private randomDieValue(die: CombatDie): number {
        const sides = die === 'D4' ? D4_SIDES : D6_SIDES;
        return Math.floor(Math.random() * sides) + 1;
    }
}
