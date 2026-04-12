import { CombatTurnService } from '@app/services/combat/combat-turn.service';
import { CombatService } from '@app/services/combat/combat.service';
import * as matchutils from '@app/services/game-session/game-session.match';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { makeMatch, makeMatchPlayer, makeTurnState } from '@app/services/game-session/game-session.service.spec-helpers';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import { DIE_D4_SIDES, DIE_D6_SIDES } from '@common/character/character.model';
import { Test } from '@nestjs/testing';
import { TestingModule } from '@nestjs/testing/testing-module';
import { makeCombatSession, makeFighter } from './combat-service.helper';
import { CombatEvents } from '@app/utilities/combat/combat.enums';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('CombatService Helpers', () => {
    let service: CombatService;
    let gameSessionMock: Partial<GameSessionService>;
    let turnServiceMock: Partial<CombatTurnService>;
    let eventEmitterMock: Partial<EventEmitter2>;
    let emitSpy: jest.SpyInstance;

    beforeEach(async () => {

        gameSessionMock = {
            on: jest.fn(),
            off: jest.fn(),
            getSessionById: jest.fn(),
            endCombat: jest.fn(),
            getMatchFromSessionId: jest.fn(),
            setWinner: jest.fn(),
        };

        turnServiceMock = {
            startTransition: jest.fn(),
            advanceToNextTurn: jest.fn(),
        };

        eventEmitterMock = {
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [CombatService,
            { provide: GameSessionService, useValue: gameSessionMock },
            { provide: CombatTurnService, useValue: turnServiceMock },
            { provide: EventEmitter2, useValue: eventEmitterMock },
            ],
        }).compile();

        service = module.get<CombatService>(CombatService);

        emitSpy = jest.spyOn(eventEmitterMock, 'emit');

        jest.clearAllMocks();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any)['combatSessions'].clear();
    });

    it('should return the combat id if it is part of the rooms', () => {
        const combatSession = makeCombatSession();
        const rooms = ['hkshd', 'djshnc', combatSession.id];
        service['combatSessions'].set(combatSession.id, combatSession);

        const result = service.getCombatIdByRooms(rooms);

        expect(result).toBe(combatSession.id);
    });

    it('should return undefined if the room does not correspond to any combat session', () => {
        const rooms = ['hkshd', 'djshnc'];
        const result = service.getCombatIdByRooms(rooms);
        expect(result).toBe(undefined);
    });
    
    it('should return the session if the player is in a combat session - getCombatFromPlayer', () => {
        const session = makeCombatSession();
        service['combatSessions'].set(session.id, session);
        const result = service.getCombatFromPlayer('player1');
        expect(result).toBe(session);
        service['combatSessions'].delete(session.id);
    });
    
    it('should return undefined if the player is not part of a combat session - getCombatFromPlayer', () => {
        const session = makeCombatSession();
        service['combatSessions'].set(session.id, session);
        const result = service.getCombatFromPlayer('player3');
        expect(result).toBe(undefined);
        service['combatSessions'].delete(session.id);
    });

    it('should create a fighter if player is defined - createFighter', () => {
        const player = makeMatchPlayer({id: 'player1'});
        const players = [player];

        const fighter = service['createFighter'](players, player.id);

        expect(fighter).toEqual({
            stats: player,
            combatStance: null,
            hasSelectedStance: false,
            hasPenalty: false,
        });
    });

    it('should create a fighter if the player is undefined - createFighter', () => {
        const players = [];
        const fighter = service['createFighter'](players, 'player1');

        expect(fighter).toEqual({
            stats: undefined,
            combatStance: null,
            hasSelectedStance: false,
            hasPenalty: false,
        });
    });

    it('should return false if session is undefined', () => {
        const result = service['setCombatStance'](
            undefined,
            'player1',
            'attack',
        );
        expect(result).toBe(false);
    });

    it('should return false is player is not in the combat session', () => {
        const session = makeCombatSession({
            turnState: makeTurnState({phase: 'active', activePlayerId: 'player1'}),
            players: [makeFighter({stats: makeMatchPlayer({id:'player3'})})]});
        const result = service['setCombatStance'](session, 'player1', 'attack');
        expect(result).toBe(false);
    });

    it('should return true if the combat stance is successfully set', () => {
        const session = makeCombatSession({
            turnState: makeTurnState({phase: 'active', activePlayerId: 'player1'}),
            players: [makeFighter({stats: makeMatchPlayer({id:'player1'})})]});
        const result = service['setCombatStance'](session, 'player1', 'attack');
        expect(result).toBe(true);
        expect(session.players[0].combatStance).toBe('attack');
        expect(session.players[0].hasSelectedStance).toBe(true);
    });

    it('should emit the correct payload - emitCombatResultSnapshot', () => {
        const session = makeCombatSession();
        const winner = '1234';
        const loser = '5678';

        service['emitCombatResultSnapshot'](CombatEvents.Victory, session, winner, loser);

        expect(emitSpy).toHaveBeenCalledWith(CombatEvents.Victory, {
            combatId: session.id,
            gameSessionId: session.gameSessionId,
            winner,
            loser,
        });
    });

    it('should roll with D4 if the die is a D4 string - rollDie', () => {
        const RANDOM_VALUE = 0.5;
        jest.spyOn(Math, 'random').mockReturnValue(RANDOM_VALUE);

        const result = service['rollDie']('D4');

        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(DIE_D4_SIDES);
    });

    it('should roll D6 if the die string is D6 - rollDie', () => {
        const RANDOM_VALUE = 0.5;
        jest.spyOn(Math, 'random').mockReturnValue(RANDOM_VALUE);

        const result = service['rollDie']('D6');

        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(DIE_D6_SIDES);
    });

    it('should never be lower than 1 - rollDie', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = service['rollDie']('D6');

        expect(result).toBe(1);
    });

    it('should never exceed the maximum number of die sides - rollDie', () => {
        const RANDOM_VALUE = 0.9999;
        jest.spyOn(Math, 'random').mockReturnValue(RANDOM_VALUE);

        const resultD4 = service['rollDie']('D4');
        const resultD6 = service['rollDie']('D6');

        expect(resultD4).toBe(DIE_D4_SIDES);
        expect(resultD6).toBe(DIE_D6_SIDES);
    });

    it('should produce an integer only', () => {
        const RANDOM_VALUE = 0.42;
        jest.spyOn(Math, 'random').mockReturnValue(RANDOM_VALUE);
        const result = service['rollDie']('D6');
        expect(Number.isInteger(result)).toBe(true);
    });

    it('should return false if the match does not exist - isFighterOnIce', () => {
        const spy = jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(undefined);
        const result = service['isFighterOnIce']('1234', '3456');
        expect(spy).toHaveBeenCalledWith('1234');
        expect(result).toBe(false);
    });

    it('should return the value of isPlayerOnIce if the match exists - isFighterOnIce', () => {
        const match = makeMatch();
        const spy = jest.spyOn(gameSessionMock, 'getMatchFromSessionId').mockReturnValue(match);
        const spy2 = jest.spyOn(matchutils, 'isPlayerOnIce').mockReturnValue(true);

        const result = service['isFighterOnIce']('1234', '3456');

        expect(spy).toHaveBeenCalledWith('1234');
        expect(spy2).toHaveBeenCalledWith(match, '3456');
        expect(result).toBe(true);
    });

    it('should return undefined if the session is not found - updatePlayerHealth', () => {
        const DAMAGE = 6;
        const result = service['updatePlayerHealth']('1234', '4567', DAMAGE);
        expect(result).toBe(undefined);
    });

    it('should return the undefined if the player is not found - updatePlayerHealth', () => {
        const DAMAGE = 6;
        const session = makeCombatSession({players: [makeFighter({}, {id: 'player1'})]});
        service['combatSessions'].set(session.id, session);
        const result = service['updatePlayerHealth'](session.id, 'player3', DAMAGE);
        expect(result).toBe(undefined);
    });

    it('should update the player health according to the amount of damage - updatePlayerHealth', () => {
        const DAMAGE = 4;
        const HEALTH = 6;
        const session = makeCombatSession({players: [makeFighter({}, {id: 'player1'})]});
        service['combatSessions'].set(session.id, session);

        const result = service['updatePlayerHealth'](session.id, 'player1', DAMAGE);

        expect(session.players[0].stats.health).not.toBe(HEALTH);
        expect(result).toBe(session.players[0]);
    });

    it('should never set the player health lower than 0 - updatePlayerHealth', () => {
        const DAMAGE = 8;
        const session = makeCombatSession({players: [makeFighter({}, {id: 'player1'})]});
        service['combatSessions'].set(session.id, session);

        const result = service['updatePlayerHealth'](session.id, 'player1', DAMAGE);

        expect(session.players[0].stats.health).toEqual(0);
        expect(result).toBe(session.players[0]);
    });
});
