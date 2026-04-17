import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CharacterSpriteComponent } from '@app/components/game/character-sprite/character-sprite.component';
import { getTeamClass } from '@app/components/game/team-class.util';
import { CombatOutcomeNotice, CombatPanelFighter } from '@app/services/match/combat-state.models';
import { TileType } from '@common/maps/map.enums';

@Component({
    selector: 'app-game-combat-stage-arena',
    standalone: true,
    imports: [CommonModule, CharacterSpriteComponent],
    templateUrl: './game-combat-stage-arena.component.html',
    styleUrl: './game-combat-stage-arena.component.scss',
})
export class GameCombatStageArenaComponent {
    @Input({ required: true }) fighters: readonly CombatPanelFighter[] = [];
    @Input() isHorizontal = true;
    @Input() endingNotice: CombatOutcomeNotice | null = null;

    protected readonly tileType = TileType;

    protected getTeamClass(teamId: string | null): string | null {
        return getTeamClass(teamId, 'combat-stage__tile--team-');
    }

    protected getEndingTitle(ending: CombatOutcomeNotice): string {
        const localFighterId = this.fighters.find((fighter) => fighter.isLocal)?.id ?? null;
        if (localFighterId === ending.attackerId) {
            return 'Victoire';
        }

        if (localFighterId === ending.defenderId) {
            return ending.defenderMessage.startsWith('Égalité') ? 'Égalité' : 'Défaite';
        }

        return 'Fin du combat';
    }

    protected getEndingMessage(ending: CombatOutcomeNotice): string {
        const localFighterId = this.fighters.find((fighter) => fighter.isLocal)?.id ?? null;
        if (localFighterId === ending.attackerId) {
            return ending.attackerMessage;
        }

        if (localFighterId === ending.defenderId) {
            return ending.defenderMessage;
        }

        return ending.logMessage;
    }
}