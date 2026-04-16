import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { GameCombatDiceComponent } from '@app/components/game/game-combat-dice/game-combat-dice.component';
import { GameCombatStageArenaComponent } from '@app/components/game/game-combat-stage-arena/game-combat-stage-arena.component';
import { CombatOutcomeNotice, CombatPanelFighter } from '@app/services/match/combat-state.models';

@Component({
    selector: 'app-game-combat-stage-frame',
    standalone: true,
    imports: [CommonModule, GameCombatDiceComponent, GameCombatStageArenaComponent],
    templateUrl: './game-combat-stage-frame.component.html',
    styleUrl: './game-combat-stage-frame.component.scss',
})
export class GameCombatStageFrameComponent {
    @Input({ required: true }) fighters: readonly CombatPanelFighter[] = [];
    @Input() isHorizontal = true;
    @Input() endingNotice: CombatOutcomeNotice | null = null;
}