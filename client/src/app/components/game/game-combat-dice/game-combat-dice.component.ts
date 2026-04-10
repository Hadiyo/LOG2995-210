import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

type CombatDie = 'D4' | 'D6';

@Component({
    selector: 'app-game-combat-dice',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-combat-dice.component.html',
    styleUrl: './game-combat-dice.component.scss',
})
export class GameCombatDiceComponent {
    @Input({ required: true }) attackDie!: CombatDie;
    @Input({ required: true }) defenseDie!: CombatDie;
    @Input() side: 'left' | 'right' = 'left';

    protected getDieShapeClass(die: CombatDie): string {
        return die === 'D4' ? 'combat-dice__die--d4' : 'combat-dice__die--d6';
    }

    protected getDieColorClass(die: CombatDie): string {
        return die === 'D4' ? 'combat-dice__die--blue' : 'combat-dice__die--green';
    }
}
