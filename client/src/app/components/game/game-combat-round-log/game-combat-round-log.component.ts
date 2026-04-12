import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CombatRoundBreakdown, CombatRoundLog, CombatStanceChoice } from '@app/services/match/combat-state.models';

@Component({
    selector: 'app-game-combat-round-log',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-combat-round-log.component.html',
    styleUrl: './game-combat-round-log.component.scss',
})
export class GameCombatRoundLogComponent implements AfterViewInit, OnChanges {
    @Input({ required: true }) logs: readonly CombatRoundLog[] = [];

    @ViewChild('viewport') private viewportRef?: ElementRef<HTMLDivElement>;

    private shouldStickToBottom = true;

    ngAfterViewInit(): void {
        this.scrollToBottom();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.logs) {
            this.queueAutoscroll();
        }
    }

    protected trackRound(index: number, round: CombatRoundLog): string {
        void index;
        return round.id;
    }

    protected onScroll(): void {
        const viewport = this.viewportRef?.nativeElement;
        if (!viewport) {
            return;
        }

        const threshold = 20;
        this.shouldStickToBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - threshold;
    }

    protected stanceLabel(stance: CombatStanceChoice): string {
        if (stance === 'attack') {
            return 'Offensive';
        }

        if (stance === 'defense') {
            return 'Defensive';
        }

        return 'Aucune';
    }

    protected fighterOutcome(round: CombatRoundLog, fighterIndex: 0 | 1): 'pending' | 'win' | 'lose' | 'draw' {
        const fighter = round.fighters[fighterIndex];
        const opponent = round.fighters[fighterIndex === 0 ? 1 : 0];
        if (fighter.damage === null || opponent.damage === null) {
            return 'pending';
        }

        if (fighter.damage > opponent.damage) {
            return 'win';
        }

        if (fighter.damage < opponent.damage) {
            return 'lose';
        }

        return 'draw';
    }

    protected attackSucceeded(round: CombatRoundLog, fighterIndex: 0 | 1): boolean | null {
        const delta = round.fighters[fighterIndex].attackDelta;
        return delta === null ? null : delta > 0;
    }

    protected defenseSucceeded(round: CombatRoundLog, fighterIndex: 0 | 1): boolean | null {
        const opponentDelta = round.fighters[fighterIndex === 0 ? 1 : 0].attackDelta;
        return opponentDelta === null ? null : opponentDelta <= 0;
    }

    protected dieClass(dieType: CombatRoundBreakdown['dieType']): string {
        return dieType === 'D6' ? 'combat-round-log__die--d6' : 'combat-round-log__die--d4';
    }

    protected signedValue(value: number): string {
        if (value > 0) {
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

    protected resultLabel(round: CombatRoundLog, fighterIndex: 0 | 1): string {
        const fighter = round.fighters[fighterIndex];
        if (fighter.damage === null || fighter.attackDelta === null) {
            return 'En attente du lancer';
        }

        if (fighter.damage > 0) {
            return `Diff ${this.signedValue(fighter.attackDelta)} | Degats ${fighter.damage}`;
        }

        return `Diff ${this.signedValue(fighter.attackDelta)} | Aucun degat`;
    }

    protected damageLabel(round: CombatRoundLog, fighterIndex: 0 | 1): string {
        const fighter = round.fighters[fighterIndex];
        if (fighter.damage === null) {
            return 'Degats --';
        }

        return fighter.damage > 0 ? `Degats ${fighter.damage}` : 'Aucun degat';
    }

    private queueAutoscroll(): void {
        if (!this.shouldStickToBottom) {
            return;
        }

        window.setTimeout(() => this.scrollToBottom());
    }

    private scrollToBottom(): void {
        const viewport = this.viewportRef?.nativeElement;
        if (!viewport) {
            return;
        }

        viewport.scrollTop = viewport.scrollHeight;
    }
}
