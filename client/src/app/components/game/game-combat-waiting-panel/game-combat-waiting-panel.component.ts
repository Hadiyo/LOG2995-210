import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CombatWaitingState } from '@app/services/match/combat-state.models';

@Component({
    selector: 'app-game-combat-waiting-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-combat-waiting-panel.component.html',
    styleUrl: './game-combat-waiting-panel.component.scss',
})
export class GameCombatWaitingPanelComponent {
    @Input({ required: true }) waitingState!: CombatWaitingState;

    protected getTimerLabel(): string {
        if (this.waitingState.phase === 'transition') {
            return 'Resolution du tour';
        }
        return this.waitingState.activePlayerName ? `Tour de ${this.waitingState.activePlayerName}` : 'Tour en cours';
    }
}
