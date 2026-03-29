import {
    createGameSessionServiceHarness,
    makeMatch,
    makeMatchPlayer,
    makeRuntime,
    makeTurnState,
} from './game-session.service.spec-helpers';
import { TileType } from '@common/maps/map.enums';

const VIRTUAL_DECISION_WAIT_MS = 500;

describe('GameSessionService virtual players', () => {
    const harness = createGameSessionServiceHarness();

    it('lets an aggressive virtual player advance toward an enemy after a short delay', () => {
        const serviceInternals = harness.getServiceInternals();
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({
                        id: 'player-1',
                        name: 'Bot agressif',
                        controller: 'virtual',
                        virtualProfile: 'aggressive',
                        position: { x: 0, y: 0 },
                        startingPosition: { x: 0, y: 0 },
                    }),
                    makeMatchPlayer({
                        id: 'player-2',
                        name: 'Alice',
                        avatarId: 1,
                        position: { x: 2, y: 0 },
                        startingPosition: { x: 2, y: 0 },
                    }),
                ],
            }),
            turnState: makeTurnState({
                activePlayerId: null,
                currentTurnIndex: 0,
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                ],
                phase: 'transition',
                playerStates: [
                    { playerId: 'player-1', state: 'waiting' },
                    { playerId: 'player-2', state: 'waiting' },
                ],
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        serviceInternals.activateTurn(runtime);
        jest.advanceTimersByTime(VIRTUAL_DECISION_WAIT_MS);

        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 1, y: 0 });
        randomSpy.mockRestore();
    });

    it('lets a defensive virtual player retreat before fighting when a path exists', () => {
        const serviceInternals = harness.getServiceInternals();
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({
                        id: 'player-1',
                        name: 'Bot defensif',
                        controller: 'virtual',
                        virtualProfile: 'defensive',
                        position: { x: 1, y: 0 },
                        startingPosition: { x: 1, y: 0 },
                    }),
                    makeMatchPlayer({
                        id: 'player-2',
                        name: 'Alice',
                        avatarId: 1,
                        position: { x: 2, y: 0 },
                        startingPosition: { x: 2, y: 0 },
                    }),
                ],
            }),
            turnState: makeTurnState({
                activePlayerId: null,
                currentTurnIndex: 0,
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                ],
                phase: 'transition',
                playerStates: [
                    { playerId: 'player-1', state: 'waiting' },
                    { playerId: 'player-2', state: 'waiting' },
                ],
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        serviceInternals.activateTurn(runtime);
        jest.advanceTimersByTime(VIRTUAL_DECISION_WAIT_MS);

        const updatedBot = runtime.match.players.find((player) => player.id === 'player-1');
        expect(updatedBot).not.toBeNull();
        expect(updatedBot?.position).not.toEqual({ x: 1, y: 0 });
        expect(Math.abs((updatedBot?.position.x ?? 0) - 2) + Math.abs((updatedBot?.position.y ?? 0) - 0)).toBeGreaterThan(1);
        expect(runtime.turnState.actionTaken).toBe(false);
        randomSpy.mockRestore();
    });

    it('keeps moving toward a target when the cheapest first step is unaffordable this turn', () => {
        const serviceInternals = harness.getServiceInternals();
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
        const runtime = makeRuntime({
            match: makeMatch({
                map: [
                    { position: { x: 0, y: 0 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                    { position: { x: 1, y: 0 }, tileType: TileType.WATER, isWalkable: true, isOccupied: false },
                    { position: { x: 2, y: 0 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                    { position: { x: 0, y: 1 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                    { position: { x: 1, y: 1 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                    { position: { x: 2, y: 1 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                ],
                players: [
                    makeMatchPlayer({
                        id: 'player-1',
                        name: 'Bot agressif',
                        controller: 'virtual',
                        virtualProfile: 'aggressive',
                        position: { x: 0, y: 0 },
                        startingPosition: { x: 0, y: 0 },
                    }),
                    makeMatchPlayer({
                        id: 'player-2',
                        name: 'Alice',
                        avatarId: 1,
                        position: { x: 2, y: 0 },
                        startingPosition: { x: 2, y: 0 },
                    }),
                ],
            }),
            turnState: makeTurnState({
                activePlayerId: null,
                currentTurnIndex: 0,
                movementPointsRemaining: 1,
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                ],
                phase: 'transition',
                playerStates: [
                    { playerId: 'player-1', state: 'waiting' },
                    { playerId: 'player-2', state: 'waiting' },
                ],
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        serviceInternals.activateTurn(runtime);
        runtime.turnState = { ...runtime.turnState, movementPointsRemaining: 1 };
        jest.advanceTimersByTime(VIRTUAL_DECISION_WAIT_MS);

        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 0, y: 1 });
        expect(runtime.turnState.activePlayerId).toBe('player-1');
        randomSpy.mockRestore();
    });
});
