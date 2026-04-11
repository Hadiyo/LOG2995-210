import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameCombatDiceComponent } from '@app/components/game/game-combat-dice/game-combat-dice.component';
import { GameCombatRoundLogComponent } from '@app/components/game/game-combat-round-log/game-combat-round-log.component';
import { CharacterSpriteComponent } from '@app/components/game/character-sprite/character-sprite.component';
import { getTeamClass } from '@app/components/game/team-class.util';
import { CombatOutcomeNotice, CombatPanelState, CombatRoundLog } from '@app/services/match/combat-state.models';
import { CombatStateService } from '@app/services/match/combat-state.service';
import { TileType } from '@common/maps/map.enums';

@Component({
    selector: 'app-game-combat-panel',
    standalone: true,
    imports: [CommonModule, CharacterSpriteComponent, GameCombatDiceComponent, GameCombatRoundLogComponent],
    templateUrl: './game-combat-panel.component.html',
    styleUrl: './game-combat-panel.component.scss',
})
export class GameCombatPanelComponent {
    protected readonly combat = inject(CombatStateService);
    protected readonly tileType = TileType;
    protected readonly panelState = computed<CombatPanelState | null>(() => this.combat.panelState());
    protected readonly roundLogs = computed<readonly CombatRoundLog[]>(() => this.combat.roundLogs());
    protected readonly isHorizontal = computed(() => this.panelState()?.orientation === 'horizontal');

    protected closeCombat(): void {
        this.combat.closeCombat();
    }

    protected selectAttackStance(): void {
        this.combat.selectStance('attack');
    }

    protected selectDefenseStance(): void {
        this.combat.selectStance('defense');
    }

    protected getTeamClass(teamId: string | null): string | null {
        return getTeamClass(teamId, 'combat-stage__tile--team-');
    }

    protected getEndingTitle(ending: CombatOutcomeNotice): string {
        const localFighterId = this.panelState()?.fighters.find((fighter) => fighter.isLocal)?.id ?? null;
        if (localFighterId === ending.attackerId) {
            return 'Victoire';
        }

        if (localFighterId === ending.defenderId) {
            return ending.defenderMessage.startsWith('Egalite') ? 'Egalite' : 'Defaite';
        }

        return 'Fin du combat';
    }

    protected getEndingMessage(ending: CombatOutcomeNotice): string {
        const localFighterId = this.panelState()?.fighters.find((fighter) => fighter.isLocal)?.id ?? null;
        if (localFighterId === ending.attackerId) {
            return ending.attackerMessage;
        }

        if (localFighterId === ending.defenderId) {
            return ending.defenderMessage;
        }

        return ending.logMessage;
    }
}
