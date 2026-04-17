/**
 * Test Strategy:
 *
 * These tests validate the presentation rules and helper methods of GameCombatRoundLogComponent.
 * The goal is to ensure that combat history remains readable, localized, and deterministic as
 * rounds move through pending, revealing, and resolved states.
 *
 * Edge Cases Covered:
 * - Empty-state and ordering behavior:
 *   Verifies the component renders a stable empty state and shows the newest round first after
 *   the logs input changes.
 *
 * - Outcome rendering and localized labels:
 *   Covers win, lose, draw, pending, and revealing states along with stance labels, die classes,
 *   and damage/result copy so the round log reflects combat outcomes consistently.
 *
 * - Defensive helper branches:
 *   Verifies fallback behavior for null deltas, null damage values, unresolved rounds, invalid
 *   fighter indices, and missing opponent lookups to keep the component robust under partial data.
 *
 * Rationale:
 * These edge cases were selected because the round log is purely presentational but highly visible.
 * Small regressions here can quickly turn combat history into misleading or inconsistent UI, especially
 * when data is partial during animation phases. Testing these paths keeps the log readable, localized,
 * and stable across pending, revealing, and resolved states.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatRoundLog } from '@app/services/match/combat-state.models';
import { GameCombatRoundLogComponent } from './game-combat-round-log.component';

const createRoundLog = (overrides: Partial<CombatRoundLog> = {}): CombatRoundLog => ({
    id: 'round-1',
    round: 1,
    status: 'resolved',
    fighters: [
        {
            fighterId: 'attacker',
            fighterName: 'Attacker',
            isLocal: true,
            stance: 'attack',
            attack: { base: 4, postureBonus: 2, dieType: 'D6', dieValue: 5, penalty: 0, total: 11 },
            defense: { base: 4, postureBonus: 0, dieType: 'D4', dieValue: 1, penalty: 0, total: 5 },
            attackDelta: 3,
            damage: 3,
        },
        {
            fighterId: 'defender',
            fighterName: 'Defender',
            isLocal: false,
            stance: 'defense',
            attack: { base: 4, postureBonus: 0, dieType: 'D4', dieValue: 2, penalty: 0, total: 6 },
            defense: { base: 4, postureBonus: 2, dieType: 'D6', dieValue: 5, penalty: 0, total: 11 },
            attackDelta: 0,
            damage: 0,
        },
    ],
    ...overrides,
});

describe('GameCombatRoundLogComponent', () => {
    let component: GameCombatRoundLogComponent;
    let fixture: ComponentFixture<GameCombatRoundLogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameCombatRoundLogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCombatRoundLogComponent);
        component = fixture.componentInstance;
    });

    it('should render the empty state when no combat logs exist', () => {
        fixture.componentRef.setInput('logs', []);
        fixture.detectChanges();

        expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucun détail de tour pour le moment.');
    });

    it('should render resolved round details with win/lose styling, stance labels, and die classes', () => {
        fixture.componentRef.setInput('logs', [createRoundLog()]);
        fixture.detectChanges();

        const element: HTMLElement = fixture.nativeElement;
        const fighterPanels = element.querySelectorAll('.combat-round-log__fighter');

        expect(fighterPanels[0].classList).toContain('combat-round-log__fighter--win');
        expect(fighterPanels[1].classList).toContain('combat-round-log__fighter--lose');
        expect(element.textContent).toContain('Offensive');
        expect(element.textContent).toContain('Défensive');
        expect(element.querySelector('.combat-round-log__die--d6')).not.toBeNull();
        expect(element.querySelector('.combat-round-log__die--d4')).not.toBeNull();
        expect(element.textContent).toContain('Diff +3');
        expect(element.textContent).toContain('Dégâts 3');
    });

    it('should render a draw outcome on both fighter panels when damage is tied', () => {
        fixture.componentRef.setInput('logs', [createRoundLog({
            fighters: [
                { ...createRoundLog().fighters[0], attackDelta: 0, damage: 0 },
                { ...createRoundLog().fighters[1], attackDelta: 0, damage: 0 },
            ],
        })]);
        fixture.detectChanges();

        const fighterPanels = fixture.nativeElement.querySelectorAll('.combat-round-log__fighter');
        expect(fighterPanels[0].classList).toContain('combat-round-log__fighter--draw');
        expect(fighterPanels[1].classList).toContain('combat-round-log__fighter--draw');
    });

    it('should render pending and revealing round states with the proper labels', () => {
        fixture.componentRef.setInput('logs', [
            createRoundLog({ id: 'pending', round: 1, status: 'pending' }),
            createRoundLog({ id: 'revealing', round: 2, status: 'revealing' }),
        ]);
        fixture.detectChanges();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('En attente');
        expect(text).toContain('Résolution');
    });

    it('should render the newest round first after the logs input changes', () => {
        fixture.componentRef.setInput('logs', [
            createRoundLog({ id: 'round-1', round: 1 }),
            createRoundLog({ id: 'round-2', round: 2 }),
        ]);
        fixture.detectChanges();

        const chips = Array.from(fixture.nativeElement.querySelectorAll('.combat-round-log__round-chip')) as HTMLElement[];
        expect(chips[0].textContent).toContain('Tour 2');
        expect(chips[1].textContent).toContain('Tour 1');
    });

    it('should expose direct helpers for pending values, signed values, and non damaging results', () => {
        const pendingRound = createRoundLog({
            status: 'pending',
            fighters: [
                { ...createRoundLog().fighters[0], attackDelta: null, damage: null },
                { ...createRoundLog().fighters[1], attackDelta: null, damage: null },
            ],
        });
        const drawRound = createRoundLog({
            fighters: [
                { ...createRoundLog().fighters[0], attackDelta: 0, damage: 0 },
                { ...createRoundLog().fighters[1], attackDelta: 0, damage: 0 },
            ],
        });
        const resolvedNullValueRound = createRoundLog({
            fighters: [
                { ...createRoundLog().fighters[0], attackDelta: null, damage: null },
                { ...createRoundLog().fighters[1], attackDelta: null, damage: null },
            ],
        });
        const singleFighterRound = {
            ...createRoundLog(),
            fighters: [{ ...createRoundLog().fighters[0], attackDelta: null, damage: null }],
        } as unknown as CombatRoundLog;

        expect((component as unknown as { attackSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .attackSucceeded(pendingRound, 0)).toBeNull();
        expect((component as unknown as { defenseSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .defenseSucceeded(pendingRound, 0)).toBeNull();
        expect((component as unknown as { signedValue: (value: number) => string }).signedValue(2)).toBe('+2');
        expect((component as unknown as { signedValue: (value: number) => string }).signedValue(0)).toBe('0');
        expect((component as unknown as { displayValue: (value: number | null) => string }).displayValue(null)).toBe('--');
        expect((component as unknown as { displayValue: (value: number | null) => string }).displayValue(4)).toBe('4');
        expect((component as unknown as { breakdownTotal: (breakdown: CombatRoundLog['fighters'][0]['attack']) => string })
            .breakdownTotal({ ...drawRound.fighters[0].attack, total: null })).toBe('--');
        expect((component as unknown as { breakdownTotal: (breakdown: CombatRoundLog['fighters'][0]['attack']) => string })
            .breakdownTotal(createRoundLog().fighters[0].attack)).toBe('11');
        expect(
            (component as unknown as { stanceLabel: (stance: CombatRoundLog['fighters'][0]['stance']) => string }).stanceLabel(null),
        ).toBe('Aucune');
        expect((component as unknown as { stanceLabel: (stance: CombatRoundLog['fighters'][0]['stance']) => string }).stanceLabel('defense'))
            .toBe('Défensive');
        expect((component as unknown as { combatFighterIndex: (index: number) => 0 | 1 }).combatFighterIndex(99)).toBe(0);
        expect((component as unknown as { fighterOutcome: (round: CombatRoundLog, index: 0 | 1) => string }).fighterOutcome(pendingRound, 0))
            .toBe('pending');
        expect((component as unknown as { fighterOutcome: (round: CombatRoundLog, index: 0 | 1) => string }).fighterOutcome(drawRound, 0))
            .toBe('draw');
        expect(
            (component as unknown as { fighterOutcome: (round: CombatRoundLog, index: 0 | 1) => string })
                .fighterOutcome(resolvedNullValueRound, 0),
        )
            .toBe('draw');
        expect((component as unknown as { resultLabel: (round: CombatRoundLog, index: 0 | 1) => string }).resultLabel(pendingRound, 0))
            .toBe('En attente du lancer');
        expect((component as unknown as { resultLabel: (round: CombatRoundLog, index: 0 | 1) => string }).resultLabel(createRoundLog(), 0))
            .toContain('Dégâts 3');
        expect((component as unknown as { resultLabel: (round: CombatRoundLog, index: 0 | 1) => string })
            .resultLabel(drawRound, 0)).toContain('Aucun dégât');
        expect((component as unknown as { damageLabel: (round: CombatRoundLog, index: 0 | 1) => string })
            .damageLabel(pendingRound, 0)).toBe('Dégâts --');
        expect((component as unknown as { damageLabel: (round: CombatRoundLog, index: 0 | 1) => string })
            .damageLabel(drawRound, 0)).toBe('Aucun dégât');
        expect((component as unknown as { attackSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .attackSucceeded(resolvedNullValueRound, 0)).toBeFalse();
        expect((component as unknown as { defenseSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .defenseSucceeded(resolvedNullValueRound, 0)).toBeTrue();
        expect((component as unknown as { getOpponentFighter: (round: CombatRoundLog, index: 0 | 1) => CombatRoundLog['fighters'][number] })
            .getOpponentFighter(singleFighterRound, 0)).toEqual(singleFighterRound.fighters[0]);
        expect((component as unknown as { isResolved: (round: CombatRoundLog) => boolean }).isResolved(drawRound)).toBeTrue();
    });

    it('should expose positive and negative success helpers for resolved rounds', () => {
        const resolvedRound = createRoundLog();
        const blockedRound = createRoundLog({
            fighters: [
                { ...createRoundLog().fighters[0], attackDelta: -1, damage: 0 },
                { ...createRoundLog().fighters[1], attackDelta: 2, damage: 2 },
            ],
        });

        expect((component as unknown as { attackSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .attackSucceeded(resolvedRound, 0)).toBeTrue();
        expect((component as unknown as { attackSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .attackSucceeded(blockedRound, 0)).toBeFalse();
        expect((component as unknown as { defenseSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .defenseSucceeded(resolvedRound, 0)).toBeTrue();
        expect((component as unknown as { defenseSucceeded: (round: CombatRoundLog, index: 0 | 1) => boolean | null })
            .defenseSucceeded(blockedRound, 0)).toBeFalse();
    });
});
