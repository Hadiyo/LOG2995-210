import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameCombatRoundLogComponent } from '@app/components/game/game-combat-round-log/game-combat-round-log.component';
import { GameCombatStageFrameComponent } from '@app/components/game/game-combat-stage-frame/game-combat-stage-frame.component';
import { CombatPanelState, CombatRoundLog } from '@app/services/match/combat-state.models';
import { CombatStateService } from '@app/services/match/combat-state.service';

@Component({
    selector: 'app-game-combat-panel',
    standalone: true,
    imports: [CommonModule, GameCombatRoundLogComponent, GameCombatStageFrameComponent],
    templateUrl: './game-combat-panel.component.html',
    styleUrl: './game-combat-panel.component.scss',
})
export class GameCombatPanelComponent {
    protected readonly combat = inject(CombatStateService);
    protected readonly panelState = computed<CombatPanelState | null>(() => this.combat.panelState());
    protected readonly roundLogs = computed<readonly CombatRoundLog[]>(() => this.combat.roundLogs());
    protected readonly timerLabel = computed(() => this.combat.timerLabel());

    protected selectAttackStance(): void {
        this.combat.selectStance('attack');
    }

    protected selectDefenseStance(): void {
        this.combat.selectStance('defense');
    }
}
