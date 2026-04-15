/**
 * Test Strategy:
 *
 * These tests validate the rendering contract of GameCombatPanelComponent and its direct
 * integration points with CombatStateService. The goal is to ensure that the panel displays
 * the current combat state accurately and routes local actions to the combat service without
 * introducing presentation regressions.
 *
 * Edge Cases Covered:
 * - Combat shell rendering and metadata:
 *   Verifies the title, round counter, timer label, and countdown are rendered from the current
 *   panel state so the player always sees the expected combat context.
 *
 * - Local interaction states:
 *   Ensures stance buttons are disabled when selection is unavailable and that attack/defense
 *   clicks are forwarded to CombatStateService when interaction is allowed.
 *
 * - Ending notice perspective handling:
 *   Covers attacker, defender, tie, defeat, and no-local-fighter cases so the displayed ending
 *   title and message remain correct for the player's point of view.
 *
 * Rationale:
 * These edge cases were selected because GameCombatPanelComponent is the player's main combat
 * surface. If its rendering or action wiring is wrong, the user either sees misleading combat
 * information or cannot interact at the right time. These tests protect the panel's display
 * contract and its direct integration with CombatStateService.
 */

import { CommonModule } from '@angular/common';
import { Component, Input, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatOutcomeNotice, CombatPanelState, CombatRoundLog, CombatStanceChoice } from '@app/services/match/combat-state.models';
import { CombatStateService } from '@app/services/match/combat-state.service';
import { TileType } from '@common/maps/map.enums';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { GameCombatPanelComponent } from './game-combat-panel.component';

@Component({
    selector: 'app-character-sprite',
    standalone: true,
    template: '<div class="mock-character-sprite">{{ state }}</div>',
})
class MockCharacterSpriteComponent {
    @Input() avatarId = 0;
    @Input() state = '';
    @Input() direction = '';
    @Input() fitToHost = false;
    @Input() smoothingEnabled = false;
    @Input() ariaLabel: string | null = null;
}

@Component({
    selector: 'app-game-combat-dice',
    standalone: true,
    template: '<div class="mock-combat-dice"></div>',
})
class MockGameCombatDiceComponent {
    @Input() attackDie!: 'D4' | 'D6';
    @Input() defenseDie!: 'D4' | 'D6';
    @Input() attackValue: number | null = null;
    @Input() defenseValue: number | null = null;
    @Input() rollToken = 0;
    @Input() side: 'left' | 'right' = 'left';
}

@Component({
    selector: 'app-game-combat-round-log',
    standalone: true,
    template: '<div class="mock-round-log">{{ logs.length }}</div>',
})
class MockGameCombatRoundLogComponent {
    @Input() logs: readonly CombatRoundLog[] = [];
}

type CombatStateServiceStub = {
    panelState: WritableSignal<CombatPanelState | null>;
    roundLogs: WritableSignal<CombatRoundLog[]>;
    timerLabel: WritableSignal<string>;
    endingNotice: WritableSignal<CombatOutcomeNotice | null>;
    footerMessage: WritableSignal<string>;
    localSelectedStance: WritableSignal<CombatStanceChoice>;
    canSelectStance: WritableSignal<boolean>;
    selectStance: jasmine.Spy;
};

const createPanelState = (): CombatPanelState => ({
    id: 'combat-1',
    attackerId: 'attacker',
    defenderId: 'defender',
    orientation: 'horizontal',
    round: 3,
    countdownSeconds: 7,
    fighters: [
        {
            id: 'attacker',
            name: 'Attacker',
            avatarId: 0,
            attackDie: 'D6',
            defenseDie: 'D4',
            attackRollValue: null,
            defenseRollValue: null,
            rollToken: 0,
            baseAttack: 4,
            baseDefense: 4,
            currentHealth: 5,
            maxHealth: 6,
            tileType: TileType.WATER,
            isDoorOpen: false,
            facing: PlayerFacing.Right,
            pose: PlayerPose.Idle,
            isDefending: false,
            isHit: false,
            teamId: null,
            isLocal: true,
        },
        {
            id: 'defender',
            name: 'Defender',
            avatarId: 1,
            attackDie: 'D6',
            defenseDie: 'D4',
            attackRollValue: null,
            defenseRollValue: null,
            rollToken: 0,
            baseAttack: 4,
            baseDefense: 4,
            currentHealth: 3,
            maxHealth: 6,
            tileType: TileType.ICE,
            isDoorOpen: false,
            facing: PlayerFacing.Left,
            pose: PlayerPose.Idle,
            isDefending: false,
            isHit: false,
            teamId: null,
            isLocal: false,
        },
    ],
});

describe('GameCombatPanelComponent', () => {
    let fixture: ComponentFixture<GameCombatPanelComponent>;
    let combatStub: CombatStateServiceStub;

    beforeEach(async () => {
        combatStub = {
            panelState: signal(createPanelState()),
            roundLogs: signal([]),
            timerLabel: signal('Votre tour'),
            endingNotice: signal(null),
            footerMessage: signal('Choisissez une posture pour préparer le combat.'),
            localSelectedStance: signal<CombatStanceChoice>(null),
            canSelectStance: signal(true),
            selectStance: jasmine.createSpy('selectStance'),
        };

        TestBed.overrideComponent(GameCombatPanelComponent, {
            set: {
                imports: [CommonModule, MockCharacterSpriteComponent, MockGameCombatDiceComponent, MockGameCombatRoundLogComponent],
            },
        });

        await TestBed.configureTestingModule({
            imports: [GameCombatPanelComponent],
            providers: [{ provide: CombatStateService, useValue: combatStub }],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCombatPanelComponent);
    });

    it('should render the combat panel with its current timer label and countdown', () => {
        fixture.detectChanges();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('Duel rapproché');
        expect(text).toContain('Tour 3');
        expect(text).toContain('Votre tour: 7s');
    });

    it('should disable posture buttons when the player cannot select a stance', () => {
        combatStub.canSelectStance.set(false);
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('.combat-shell__button') as NodeListOf<HTMLButtonElement>;
        expect(buttons[0].disabled).toBeTrue();
        expect(buttons[1].disabled).toBeTrue();
    });

    it('should forward offensive and defensive stance clicks to the combat service', () => {
        fixture.detectChanges();

        const buttons = fixture.nativeElement.querySelectorAll('.combat-shell__button') as NodeListOf<HTMLButtonElement>;
        buttons[0].click();
        buttons[1].click();

        expect(combatStub.selectStance).toHaveBeenCalledWith('attack');
        expect(combatStub.selectStance).toHaveBeenCalledWith('defense');
    });

    it('should expose helper methods for team classes', () => {
        expect((fixture.componentInstance as unknown as { getTeamClass: (teamId: string | null) => string | null }).getTeamClass('A'))
            .toBe('combat-stage__tile--team-a');
        expect((fixture.componentInstance as unknown as { getTeamClass: (teamId: string | null) => string | null }).getTeamClass(null))
            .toBeNull();
    });

    it('should render the local victory ending notice inside the combat stage', () => {
        combatStub.endingNotice.set({
            id: 'notice-1',
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerMessage: 'Victoire contre Defender.',
            defenderMessage: 'Défaite contre Attacker.',
            logMessage: 'Attacker remporte le combat.',
        });
        fixture.detectChanges();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('Victoire');
        expect(text).toContain('Victoire contre Defender.');
    });

    it('should render defeat or tie text from the defender perspective when the local fighter is the defender', () => {
        combatStub.panelState.set({
            ...createPanelState(),
            fighters: [
                { ...createPanelState().fighters[0], isLocal: false },
                { ...createPanelState().fighters[1], isLocal: true },
            ],
        });
        combatStub.endingNotice.set({
            id: 'notice-2',
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerMessage: 'Victoire contre Defender.',
            defenderMessage: 'Égalité contre Attacker.',
            logMessage: 'Combat nul.',
        });
        fixture.detectChanges();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('Égalité');
        expect(text).toContain('Égalité contre Attacker.');
    });

    it('should return a defeat title when the local fighter is the defender and the ending is not a tie', () => {
        combatStub.panelState.set({
            ...createPanelState(),
            fighters: [
                { ...createPanelState().fighters[0], isLocal: false },
                { ...createPanelState().fighters[1], isLocal: true },
            ],
        });
        const ending: CombatOutcomeNotice = {
            id: 'notice-4',
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerMessage: 'Victoire contre Defender.',
            defenderMessage: 'Défaite contre Attacker.',
            logMessage: 'Combat terminé.',
        };

        expect((fixture.componentInstance as unknown as { getEndingTitle: (value: CombatOutcomeNotice) => string }).getEndingTitle(ending))
            .toBe('Défaite');
        expect((fixture.componentInstance as unknown as { getEndingMessage: (value: CombatOutcomeNotice) => string }).getEndingMessage(ending))
            .toBe('Défaite contre Attacker.');
    });

    it('should fall back to generic ending title and log message when no local fighter is present', () => {
        combatStub.panelState.set({
            ...createPanelState(),
            fighters: createPanelState().fighters.map((fighter) => ({ ...fighter, isLocal: false })) as CombatPanelState['fighters'],
        });
        combatStub.endingNotice.set({
            id: 'notice-3',
            attackerId: 'attacker',
            defenderId: 'defender',
            attackerMessage: 'Victoire contre Defender.',
            defenderMessage: 'Défaite contre Attacker.',
            logMessage: 'Combat terminé.',
        });
        fixture.detectChanges();

        expect((fixture.componentInstance as unknown as { getEndingTitle: (ending: CombatOutcomeNotice) => string }).getEndingTitle(
            combatStub.endingNotice() as CombatOutcomeNotice,
        )).toBe('Fin du combat');
        expect((fixture.componentInstance as unknown as { getEndingMessage: (ending: CombatOutcomeNotice) => string }).getEndingMessage(
            combatStub.endingNotice() as CombatOutcomeNotice,
        )).toBe('Combat terminé.');
    });
});
