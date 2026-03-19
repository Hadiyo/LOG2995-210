import { TestBed } from '@angular/core/testing';
import { MapApiService } from '@app/services/map/map-api.service';
import { Character } from '@common/character/character.interface';
import { ObjectType } from '@common/maps/map.enums';
import { MatchStateService } from './match-state.service';
import { TurnStateService } from './turn-state.service';
import {
    createMap,
    createPlayers,
    createSummary,
    createTurnState,
    TEST_PERSISTED_RANDOM,
    TEST_RELOAD_RANDOM,
} from './testing/match-test.fixtures';

describe('MatchStateService', () => {
    let service: MatchStateService;
    let mapApiSpy: jasmine.SpyObj<MapApiService>;
    let turnStateService: TurnStateService;

    beforeEach(() => {
        localStorage.clear();
        mapApiSpy = jasmine.createSpyObj<MapApiService>('MapApiService', ['getMapById']);

        TestBed.configureTestingModule({
            providers: [{ provide: MapApiService, useValue: mapApiSpy }],
        });

        service = TestBed.inject(MatchStateService);
        turnStateService = TestBed.inject(TurnStateService);
    });

    afterEach(() => {
        turnStateService.clear();
        localStorage.clear();
    });

    it('should derive local player speed from the chosen character bonuses', () => {
        const character: Character = {
            name: 'Runner',
            avatarId: 0,
            bonuses: {
                plusTwo: 'rapidite',
                attaqueDie: 'D6',
                defenseDie: 'D4',
            },
        };

        service.registerLocalPlayer(character, true);

        expect(service.localPlayer()?.speed).toBe(8);
        expect(service.localPlayer()?.controller).toBe('human');
    });

    it('should keep a joining player as non-organizer when registering the local player', () => {
        const character: Character = {
            name: 'Guest',
            avatarId: 1,
            bonuses: {
                plusTwo: 'vie',
                attaqueDie: 'D4',
                defenseDie: 'D6',
            },
        };

        service.registerLocalPlayer(character, false);

        expect(service.localPlayer()?.isOrganizer).toBeFalse();
    });

    it('should assign a fresh player id when a new local player is registered', () => {
        const firstCharacter: Character = {
            name: 'Organizer',
            avatarId: 0,
            bonuses: {
                plusTwo: 'rapidite',
                attaqueDie: 'D6',
                defenseDie: 'D4',
            },
        };
        const secondCharacter: Character = {
            name: 'Guest',
            avatarId: 1,
            bonuses: {
                plusTwo: 'vie',
                attaqueDie: 'D4',
                defenseDie: 'D6',
            },
        };

        service.registerLocalPlayer(firstCharacter, true);
        const firstPlayerId = service.localPlayer()?.id;

        service.registerLocalPlayer(secondCharacter, false);

        expect(service.localPlayer()?.id).not.toBe(firstPlayerId);
        expect(service.localPlayer()?.name).toBe('Guest');
        expect(service.localPlayer()?.avatarId).toBe(1);
        expect(service.localPlayer()?.isOrganizer).toBeFalse();
    });
    it('should remove the visible start point and ghost turn when a player leaves the match', () => {
        const match = service.buildInitializedMatch(createMap(), createPlayers(3), () => TEST_RELOAD_RANDOM);
        service.match.set(match);
        turnStateService.turnState.set(createTurnState(match.players));

        service.removePlayer(match.players[1].id);

        expect(service.match()?.players).toHaveSize(2);
        expect(service.match()?.objects.filter((object) => object.type === ObjectType.START)).toHaveSize(2);
        expect(turnStateService.turnState()?.order.map((entry) => entry.playerId)).toEqual([
            match.players[0].id,
            match.players[2].id,
        ]);
    });

    it('should restore a persisted pending match without reshuffling spawns on reload', async () => {
        const organizer = createPlayers(1)[0];
        const persistedMatch = service.buildInitializedMatch(createMap(), [organizer], () => TEST_PERSISTED_RANDOM);

        localStorage.setItem('pendingMatchMap', JSON.stringify(createSummary()));
        localStorage.setItem('pendingMatchLocalPlayer', JSON.stringify(organizer));
        localStorage.setItem('pendingMatchState', JSON.stringify(persistedMatch));

        mapApiSpy.getMapById.calls.reset();
        const reloadedService = TestBed.runInInjectionContext(() => new MatchStateService());
        const success = await reloadedService.initializeFromPendingSelection();

        expect(success).toBeTrue();
        expect(reloadedService.match()).toEqual(persistedMatch);
        expect(mapApiSpy.getMapById).not.toHaveBeenCalled();
    });

    it('should clear the pending room state when the local player leaves via removePlayer', () => {
        const organizer = createPlayers(1)[0];
        const persistedMatch = service.buildInitializedMatch(createMap(), [organizer], () => TEST_RELOAD_RANDOM);

        service.localPlayer.set(organizer);
        service.match.set(persistedMatch);
        localStorage.setItem('pendingMatchState', JSON.stringify(persistedMatch));
        localStorage.setItem('pendingMatchLocalPlayer', JSON.stringify(organizer));

        service.removePlayer(organizer.id);

        expect(service.localPlayer()).toBeNull();
        expect(service.match()).toBeNull();
        expect(service.state()).toBe('idle');
        expect(localStorage.getItem('pendingMatchState')).toBeNull();
        expect(localStorage.getItem('pendingMatchLocalPlayer')).toBeNull();
    });

    it('should end the match without a winner when only one player remains after abandons', () => {
        const match = service.buildInitializedMatch(createMap(), createPlayers(2), () => TEST_RELOAD_RANDOM);
        service.match.set(match);

        service.removePlayer(match.players[1].id);

        expect(service.match()?.players).toHaveSize(1);
        expect(service.match()?.endState?.winnerKind).toBe('none');
        expect(service.match()?.endState?.message).toContain(match.players[0].name);
    });

    it('should abandon the local player through roster removal before leaving the session', () => {
        const match = service.buildInitializedMatch(createMap(), createPlayers(2), () => TEST_RELOAD_RANDOM);
        const [localPlayer] = match.players;

        service.localPlayer.set(localPlayer);
        service.match.set(match);
        turnStateService.turnState.set(createTurnState(match.players));

        service.abandonLocalPlayer('Vous avez abandonne la partie.');

        expect(service.localPlayer()).toBeNull();
        expect(service.match()?.players).toHaveSize(1);
        expect(service.match()?.players[0].id).not.toBe(localPlayer.id);
        expect(service.consumeHomeReturnMessage()).toBe('Vous avez abandonne la partie.');
    });

    it('should clear the local session and expose a home return message', () => {
        const organizer = createPlayers(1)[0];
        const persistedMatch = service.buildInitializedMatch(createMap(), [organizer], () => TEST_RELOAD_RANDOM);

        service.localPlayer.set(organizer);
        service.match.set(persistedMatch);
        turnStateService.turnState.set(createTurnState(persistedMatch.players));
        localStorage.setItem('pendingMatchState', JSON.stringify(persistedMatch));
        localStorage.setItem('pendingMatchLocalPlayer', JSON.stringify(organizer));
        localStorage.setItem('pendingMatchTurnState', JSON.stringify(createTurnState(persistedMatch.players)));

        service.endLocalSession('Retour a l accueil avec explication.');

        expect(service.localPlayer()).toBeNull();
        expect(service.match()).toBeNull();
        expect(turnStateService.turnState()).toBeNull();
        expect(service.consumeHomeReturnMessage()).toBe('Retour a l accueil avec explication.');
        expect(service.consumeHomeReturnMessage()).toBeNull();
    });

    it('should clear persisted turn state when selecting a new pending match', () => {
        const persistedTurnState = createTurnState(service.buildInitializedMatch(createMap(), createPlayers(1), () => TEST_RELOAD_RANDOM).players);

        localStorage.setItem('pendingMatchTurnState', JSON.stringify(persistedTurnState));
        turnStateService.turnState.set(persistedTurnState);

        service.selectMap(createSummary());

        expect(turnStateService.turnState()).toBeNull();
        expect(localStorage.getItem('pendingMatchTurnState')).toBeNull();
    });
});
