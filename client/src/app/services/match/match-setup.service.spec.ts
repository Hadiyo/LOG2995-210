import { TestBed } from '@angular/core/testing';
import { ObjectType } from '@common/maps/map.enums';
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
    });
});
