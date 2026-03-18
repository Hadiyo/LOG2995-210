import { TestBed } from '@angular/core/testing';
import { TileType } from '@common/maps/map.enums';
import { MatchBoardService } from './match-board.service';
import { MatchSetupService } from './match-setup.service';
import {
    createMap,
    createPlayers,
    TEST_DOOR_X,
    TEST_DOOR_Y,
    TEST_RELOAD_RANDOM,
} from './testing/match-test.fixtures';

describe('MatchBoardService', () => {
    let boardService: MatchBoardService;
    let setupService: MatchSetupService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        boardService = TestBed.inject(MatchBoardService);
        setupService = TestBed.inject(MatchSetupService);
    });

    it('should inspect a closed door tile', () => {
        const match = setupService.buildInitializedMatch(createMap(), createPlayers(1), () => TEST_RELOAD_RANDOM);
        const closedDoorTile = boardService.inspectTile(match, { x: TEST_DOOR_X, y: TEST_DOOR_Y });

        expect(closedDoorTile?.tileType).toBe(TileType.DOOR);
        expect(closedDoorTile?.characteristics).toContain('Porte fermee');
        expect(closedDoorTile?.characteristics).toContain('Impassable');
    });

    it('should inspect a tile with a player on it', () => {
        const match = setupService.buildInitializedMatch(createMap(), createPlayers(1), () => TEST_RELOAD_RANDOM);
        const playerStartTile = boardService.inspectTile(match, match.players[0].startingPosition);

        expect(playerStartTile?.player?.name).toBe(match.players[0].name);
    });

    it('should respawn a defeated player on the nearest free terrain tile to an occupied start', () => {
        const match = setupService.buildInitializedMatch(createMap(), createPlayers(2), () => TEST_RELOAD_RANDOM);
        const [defeatedPlayer, blockingPlayer] = match.players;

        const aftermath = boardService.applyCombatAftermath({
            ...match,
            players: [
                { ...defeatedPlayer, position: { x: 8, y: 8 }, health: 0 },
                { ...blockingPlayer, position: { ...defeatedPlayer.startingPosition } },
            ],
        }, [defeatedPlayer.id]);

        expect(aftermath?.outcome.respawnedPlayers[0].playerId).toBe(defeatedPlayer.id);
        expect(aftermath?.nextMatch.players.find((player) => player.id === defeatedPlayer.id)?.health).toBe(defeatedPlayer.maxHealth);
    });
});
