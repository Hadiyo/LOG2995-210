import { ChatMessage } from '@common/chat/chat.interface';
import { ObjectType } from '@common/maps/map.enums';
import {
    createGameSessionServiceHarness,
    makeMatch,
    makeMatchPlayer,
    makeObject,
    makeRuntime,
    MOVEMENT_POINTS_AFTER_MOVE,
} from './game-session.service.spec-helpers';

describe('GameSessionService actions', () => {
    const harness = createGameSessionServiceHarness();

    it('toggles debug mode only for the organizer', () => {
        const runtime = makeRuntime();
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.toggleDebugMode('session-1', 'player-2')).toBe(false);
        expect(harness.service.toggleDebugMode('session-1', 'player-1')).toBe(true);
        expect(runtime.match.debugMode).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('forces debug turn ends only in valid debug sessions', () => {
        const runtime = makeRuntime({ match: makeMatch({ debugMode: true }) });
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const advanceSpy = jest.spyOn(serviceInternals, 'advanceToNextTurn').mockImplementation((() => undefined) as never);

        expect(harness.service.forceEndDebugTurn('session-1', 'player-2')).toBe(false);
        expect(harness.service.forceEndDebugTurn('session-1', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(runtime);
    });

    it('teleports the organizer in debug mode only to valid free cells', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                debugMode: true,
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 2, y: 2 } }),
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 2, y: 2 } }),
                ],
            }),
        });
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.debugTeleportPlayer('session-1', 'player-2', { x: 0, y: 1 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 9, y: 9 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 1, y: 0 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 1 })).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 2, y: 1 });
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.render?.facing).toBe('right');
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('adds chat messages only to known sessions', () => {
        const runtime = makeRuntime();
        const message: ChatMessage = {
            id: 'msg-1',
            author: 'Alice',
            content: 'hello',
            createdAt: '2026-01-01T00:00:00.000Z',
        };
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.addChatMessage('missing', message)).toBeNull();
        expect(harness.service.addChatMessage('session-1', message)).toEqual(message);
        expect(runtime.messages).toEqual([message]);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('moves the active player only when the destination is valid and affordable', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.movePlayer('missing', 'player-1', 'right')).toBe(false);
        expect(harness.service.movePlayer('session-1', 'player-2', 'right')).toBe(false);

        runtime.turnState.movementPointsRemaining = 0;
        expect(harness.service.movePlayer('session-1', 'player-1', 'right')).toBe(false);

        runtime.turnState.movementPointsRemaining = 4;
        expect(harness.service.movePlayer('session-1', 'player-1', 'right')).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 1, y: 0 });
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.render).toMatchObject({
            facing: 'right',
            pose: 'walk',
            poseDurationMs: 180,
        });
        expect(runtime.turnState.movementPointsRemaining).toBe(MOVEMENT_POINTS_AFTER_MOVE);
        expect(runtime.turnState.movementCount).toBe(1);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('toggles adjacent doors and consumes the player action', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.toggleDoor('session-1', 'player-2', { x: 0, y: 1 })).toBe(false);
        expect(harness.service.toggleDoor('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(harness.service.toggleDoor('session-1', 'player-1', { x: 0, y: 1 })).toBe(true);
        expect(runtime.match.map.find((cell) => cell.position.x === 0 && cell.position.y === 1)?.isWalkable).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.render).toMatchObject({
            facing: 'front',
            pose: 'attack',
            poseDurationMs: 220,
        });
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('starts combat only for adjacent active players and finishes the match on the win threshold', () => {
        const serviceInternals = harness.getServiceInternals();
        const privateState = harness.getPrivateState();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, combatWins: 1, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set(runtime.sessionId, runtime);

        expect(harness.service.startCombat('missing', 'player-1', 'player-2')).toBe(false);
        expect(harness.service.startCombat('session-1', 'player-2', 'player-1')).toBe(false);
        expect(harness.service.startCombat('session-1', 'player-1', 'player-2')).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.combatWins).toBe(2);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.render).toMatchObject({
            facing: 'right',
            pose: 'attack',
            poseDurationMs: 220,
        });
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);

        const winnerRuntime = makeRuntime({
            sessionId: 'winner',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, combatWins: 2, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set('winner', winnerRuntime);
        expect(harness.service.startCombat('winner', 'player-1', 'player-2')).toBe(true);
        expect(privateState.sessions.has('winner')).toBe(false);
    });
});
