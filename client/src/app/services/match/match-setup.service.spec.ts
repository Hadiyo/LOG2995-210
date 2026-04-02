import { TestBed } from '@angular/core/testing';
import { ObjectSize, ObjectType } from '@common/maps/map.enums';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { MatchSetupService } from './match-setup.service';
import { createMap, createPlayers, TEST_RELOAD_RANDOM } from './testing/match-test.fixtures';

describe('MatchSetupService', () => {
    let service: MatchSetupService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(MatchSetupService);
    });

    it('should assign unique start points and keep only active start objects visible', () => {
        const match = service.buildInitializedMatch(createMap(), createPlayers(3), () => TEST_RELOAD_RANDOM);

        expect(match.players).toHaveSize(3);
        expect(new Set(match.players.map((player) => `${player.startingPosition.x}:${player.startingPosition.y}`)).size).toBe(3);
        expect(match.objects.filter((object) => object.type === ObjectType.START)).toHaveSize(3);
        expect(match.players.every((player) => player.render?.facing === PlayerFacing.Front && player.render?.pose === PlayerPose.Idle)).toBeTrue();
    });

    it('should initialize and normalize sanctuary state from shared match snapshots', () => {
        const map = createMap();
        map.objects.push({ id: 9, type: ObjectType.REGEN, position: { x: 8, y: 8 }, size: ObjectSize.L });
        const initialized = service.buildInitializedMatch(map, createPlayers(2), () => TEST_RELOAD_RANDOM);

        expect(initialized.sanctuaryStates).toEqual([{ objectId: 9, cooldownTurnsRemaining: 0 }]);
        expect(initialized.pendingSanctuaryChoice).toBeNull();
        expect(initialized.players.every((player) =>
            player.attackBonus === 0 &&
            player.defenseBonus === 0 &&
            player.arenaBuffTurnsRemaining === 0,
        )).toBeTrue();

        const normalized = service.normalizeMatch({
            ...initialized,
            players: initialized.players.map((player, index) => ({
                ...player,
                attackBonus: undefined,
                defenseBonus: undefined,
                arenaBuffTurnsRemaining: undefined,
                render: index === 0 ? undefined : player.render,
            })),
            sanctuaryStates: [{ objectId: 9, cooldownTurnsRemaining: -2 }],
            pendingSanctuaryChoice: { playerId: initialized.players[0].id, objectId: 9 },
        });

        expect(normalized?.players[0].render?.facing).toBe(PlayerFacing.Front);
        expect(normalized?.players[0].render?.pose).toBe(PlayerPose.Idle);
        expect(normalized?.players[0].attackBonus).toBe(0);
        expect(normalized?.players[0].defenseBonus).toBe(0);
        expect(normalized?.players[0].arenaBuffTurnsRemaining).toBe(0);
        expect(normalized?.sanctuaryStates).toEqual([{ objectId: 9, cooldownTurnsRemaining: 0 }]);
        expect(normalized?.pendingSanctuaryChoice).toEqual({ playerId: initialized.players[0].id, objectId: 9 });
    });
});
