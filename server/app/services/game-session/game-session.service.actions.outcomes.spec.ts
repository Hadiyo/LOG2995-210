import { ARENA_BUFF_TURNS, SANCTUARY_COOLDOWN_TURNS } from '@app/utilities/game/game.constants';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { GameMode, ObjectSize, ObjectType } from '@common/maps/map.enums';
import {
    createGameSessionServiceHarness,
    findPlayer,
    makeCtfPlayer,
    makeMatch,
    makeMatchPlayer,
    makeObject,
    makeRuntime,
    makeSessionObjects,
} from './game-session.service.spec-helpers';

const SANCTUARY_STARTS = [{ x: 0, y: 0 }, { x: 2, y: 2 }];
const REGEN_SANCTUARY_ID = 9;
const ARENA_SANCTUARY_ID = 11;
const DAMAGED_PLAYER_HEALTH = 4;
const HEALED_PLAYER_HEALTH = 6;
const PRIVATE_COMBAT_LOG_COUNT = 4;
const registerRuntime = (runtime: ReturnType<typeof makeRuntime>, harness: ReturnType<typeof createGameSessionServiceHarness>) => {
    harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
    return runtime;
};
const spyOnEmitSnapshot = (harness: ReturnType<typeof createGameSessionServiceHarness>) =>
    jest.spyOn(harness.getServiceInternals(), 'emitSnapshot').mockImplementation((() => undefined) as never);

describe('GameSessionService action outcomes', () => {
    const harness = createGameSessionServiceHarness();

    it('adds detailed private combat logs only for the involved players', () => {
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);
        const runtime = registerRuntime(makeRuntime({
            socketToPlayerId: new Map([
                ['socket-1', 'player-1'],
                ['socket-2', 'player-2'],
                ['socket-3', 'player-3'],
            ]),
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 } }),
                ],
            }),
        }), harness);
        const statistics: CombatPlayerStatistics[] = [
            {
                attacker: { id: 'player-1', health: 6 },
                victim: { id: 'player-2', health: 4 },
                attackRoll: 3,
                defenseRoll: 2,
                attack: 10,
                defense: 7,
                attackBaseValue: 4,
                attackPostureBonus: 2,
                attackSanctuaryBonus: 1,
                attackPenalty: 0,
                defenseBaseValue: 4,
                defensePostureBonus: 0,
                defenseSanctuaryBonus: 1,
                defensePenalty: 0,
                damageDealt: 3,
            },
            {
                attacker: { id: 'player-2', health: 4 },
                victim: { id: 'player-1', health: 6 },
                attackRoll: 1,
                defenseRoll: 4,
                attack: 5,
                defense: 10,
                attackBaseValue: 4,
                attackPostureBonus: 0,
                attackSanctuaryBonus: 0,
                attackPenalty: 0,
                defenseBaseValue: 4,
                defensePostureBonus: 2,
                defenseSanctuaryBonus: 0,
                defensePenalty: 0,
                damageDealt: 0,
            },
        ];

        harness.service.appendCombatRoundLogs(runtime.sessionId, statistics);

        expect(runtime.logEntries).toHaveLength(PRIVATE_COMBAT_LOG_COUNT);
        expect(runtime.logEntries.every((entry) => entry.visibleToPlayerIds?.sort().join(',') === 'player-1,player-2')).toBe(true);
        expect(runtime.logEntries[0].entry.content).toContain('Calcul detaille pour attaque');
        expect(runtime.logEntries[0].entry.content).toContain('Calcul detaille pour attaque de Alice');
        expect(runtime.logEntries[0].entry.content).toContain('Calcul detaille pour attaque de Bob');
        expect(runtime.logEntries[1].entry.content).toContain('Calcul detaille pour defense');
        expect(runtime.logEntries[1].entry.content).toContain('Calcul detaille pour defense de Bob');
        expect(runtime.logEntries[1].entry.content).toContain('Calcul detaille pour defense de Alice');
        expect(runtime.logEntries[2].entry.content).toContain("Difference entre l'attaque de Alice et la defense de Bob");
        expect(runtime.logEntries[3].entry.content).toContain("Resultat de l'attaque de Alice contre Bob : 3 degats");
        expect(runtime.logEntries[3].entry.content).toContain("Resultat de l'attaque de Bob contre Alice : aucun degat");
        expect(harness.service.getSnapshotForSocket(runtime.sessionId, 'socket-1')?.logEntries).toHaveLength(PRIVATE_COMBAT_LOG_COUNT);
        expect(harness.service.getSnapshotForSocket(runtime.sessionId, 'socket-2')?.logEntries).toHaveLength(PRIVATE_COMBAT_LOG_COUNT);
        expect(harness.service.getSnapshotForSocket(runtime.sessionId, 'socket-3')?.logEntries).toHaveLength(0);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('declares a team victory when the flag carrier returns to the starting tile', () => {
        const runtime = registerRuntime(makeRuntime({
            sessionId: 'ctf-win',
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeCtfPlayer('player-1', 'A', { x: 1, y: 0 }, { name: 'Alice', startingPosition: { x: 0, y: 0 } }),
                    makeCtfPlayer('player-2', 'A', { x: 2, y: 0 }, { name: 'Bob', avatarId: 1, startingPosition: { x: 1, y: 0 } }),
                    makeCtfPlayer('player-3', 'B', { x: 2, y: 2 }, { name: 'Cara', avatarId: 2 }),
                    makeCtfPlayer('player-4', 'B', { x: 2, y: 1 }, { name: 'Dan', avatarId: 3 }),
                ],
                flagCarrierId: 'player-1',
            }),
        }), harness);

        expect(harness.service.movePlayer('ctf-win', 'player-1', 'left')).toBe(true);
        expect(runtime.match.endState?.winnerKind).toBe('team');
        expect(runtime.match.endState?.winnerTeamId).toBe('A');
        expect(runtime.match.endState?.message).toContain("L'équipe A remporte la partie");
    });

    it('opens a pending sanctuary choice and resolves healing on the server', () => {
        const sanctuary = makeObject({ id: REGEN_SANCTUARY_ID, type: ObjectType.REGEN, position: { x: 1, y: 0 }, size: ObjectSize.L });
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, health: DAMAGED_PLAYER_HEALTH }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 2 }, avatarId: 1 }),
                ],
                ...makeSessionObjects(SANCTUARY_STARTS, sanctuary),
                sanctuaryStates: [{ objectId: REGEN_SANCTUARY_ID, cooldownTurnsRemaining: 0 }],
            }),
        }), harness);
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        expect(harness.service.useSanctuary('session-1', 'player-1', REGEN_SANCTUARY_ID)).toBe(true);
        expect(runtime.match.pendingSanctuaryChoice).toEqual({ playerId: 'player-1', objectId: REGEN_SANCTUARY_ID });
        expect(harness.service.endTurn('session-1', 'player-1')).toBe(false);

        expect(harness.service.resolveSanctuaryChoice('session-1', 'player-1', 'normal')).toBe(true);
        expect(runtime.match.pendingSanctuaryChoice).toBeNull();
        expect(findPlayer(runtime, 'player-1')?.health).toBe(HEALED_PLAYER_HEALTH);
        expect(runtime.match.sanctuaryStates?.find((state) => state.objectId === REGEN_SANCTUARY_ID)?.cooldownTurnsRemaining)
            .toBe(SANCTUARY_COOLDOWN_TURNS);
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('utilise un sanctuaire');
        expect(emitSnapshotSpy).toHaveBeenCalledTimes(2);
    });

    it('cancels a sanctuary choice without consuming the action', () => {
        const sanctuary = makeObject({ id: REGEN_SANCTUARY_ID, type: ObjectType.REGEN, position: { x: 1, y: 0 }, size: ObjectSize.L });
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, health: DAMAGED_PLAYER_HEALTH }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 2 }, avatarId: 1 }),
                ],
                ...makeSessionObjects(SANCTUARY_STARTS, sanctuary),
                sanctuaryStates: [{ objectId: REGEN_SANCTUARY_ID, cooldownTurnsRemaining: 0 }],
            }),
        }), harness);
        spyOnEmitSnapshot(harness);

        expect(harness.service.useSanctuary('session-1', 'player-1', REGEN_SANCTUARY_ID)).toBe(true);
        expect(harness.service.resolveSanctuaryChoice('session-1', 'player-1', 'cancel')).toBe(true);
        expect(runtime.match.pendingSanctuaryChoice).toBeNull();
        expect(findPlayer(runtime, 'player-1')?.health).toBe(DAMAGED_PLAYER_HEALTH);
        expect(runtime.turnState.actionTaken).toBe(false);
        expect(runtime.logEntries).toHaveLength(0);
    });

    it('ticks arena sanctuary cooldowns and temporary buffs when turns advance', () => {
        const serviceInternals = harness.getServiceInternals();
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', attackBonus: 1, defenseBonus: 1, arenaBuffTurnsRemaining: ARENA_BUFF_TURNS }),
                    makeMatchPlayer({ id: 'player-2', avatarId: 1 }),
                ],
                sanctuaryStates: [{ objectId: ARENA_SANCTUARY_ID, cooldownTurnsRemaining: SANCTUARY_COOLDOWN_TURNS }],
            }),
        }), harness);
        jest.spyOn(serviceInternals, 'startTransition').mockImplementation((() => undefined) as never);

        runtime.turnState.activePlayerId = 'player-1';
        serviceInternals.advanceToNextTurn(runtime);
        expect(findPlayer(runtime, 'player-1')?.arenaBuffTurnsRemaining).toBe(ARENA_BUFF_TURNS - 1);
        expect(runtime.match.sanctuaryStates?.[0].cooldownTurnsRemaining).toBe(SANCTUARY_COOLDOWN_TURNS - 1);

        runtime.turnState.activePlayerId = 'player-2';
        serviceInternals.advanceToNextTurn(runtime);
        expect(findPlayer(runtime, 'player-1')?.arenaBuffTurnsRemaining).toBe(ARENA_BUFF_TURNS - 1);
        expect(runtime.match.sanctuaryStates?.[0].cooldownTurnsRemaining).toBe(SANCTUARY_COOLDOWN_TURNS - 2);

        runtime.turnState.activePlayerId = 'player-1';
        serviceInternals.advanceToNextTurn(runtime);
        expect(findPlayer(runtime, 'player-1')?.arenaBuffTurnsRemaining).toBe(0);
        expect(findPlayer(runtime, 'player-1')?.attackBonus).toBe(0);
        expect(findPlayer(runtime, 'player-1')?.defenseBonus).toBe(0);
        expect(runtime.match.sanctuaryStates?.[0].cooldownTurnsRemaining).toBe(0);
    });
});
