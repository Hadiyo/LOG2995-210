import { ChatMessage } from '@common/chat/chat.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
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

    it('refuses to close a door when the flag is on that tile in CTF', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                mode: GameMode.CTF,
                map: [
                    { position: { x: 0, y: 0 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                    { position: { x: 0, y: 1 }, tileType: TileType.DOOR, isWalkable: true, isOccupied: false },
                ],
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 }, teamId: 'A' }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1, teamId: 'B' }),
                ],
                objects: [makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 0, y: 1 } })],
                allObjects: [makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 0, y: 1 } })],
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        expect(harness.service.toggleDoor('session-1', 'player-1', { x: 0, y: 1 })).toBe(false);
    });

    it('requests and resolves a flag transfer between adjacent teammates in CTF', () => {
        const serviceInternals = harness.getServiceInternals();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);
        const runtime = makeRuntime({
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 }, teamId: 'A' }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1, teamId: 'A' }),
                ],
                flagCarrierId: 'player-1',
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        expect(harness.service.requestFlagTransfer('session-1', 'player-1', 'player-2')).toBe(true);
        expect(runtime.match.pendingFlagTransfer).toEqual({
            requesterId: 'player-1',
            receiverId: 'player-2',
            kind: 'offer',
        });
        expect(runtime.turnState.actionTaken).toBe(true);

        expect(harness.service.resolveFlagTransfer('session-1', 'player-2', true)).toBe(true);
        expect(runtime.match.pendingFlagTransfer).toBeNull();
        expect(runtime.match.flagCarrierId).toBe('player-2');
        expect(runtime.messages.at(-1)?.content).toContain('obtient le drapeau');
        expect(emitSnapshotSpy).toHaveBeenCalled();
    });

    it('logs flag pickup and clears unanswered transfers when the turn advances', () => {
        const serviceInternals = harness.getServiceInternals();
        const advanceSpy = jest.spyOn(serviceInternals, 'advanceToNextTurn');
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        const pickupRuntime = makeRuntime({
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 }, teamId: 'A' }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1, teamId: 'B' }),
                ],
                objects: [makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 1, y: 0 } })],
                allObjects: [makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 1, y: 0 } })],
                flagCarrierId: null,
            }),
        });
        harness.getPrivateState().sessions.set('pickup', pickupRuntime);
        expect(harness.service.movePlayer('pickup', 'player-1', 'right')).toBe(true);
        expect(pickupRuntime.messages.at(-1)?.content).toContain('ramasse le drapeau');

        const transferRuntime = makeRuntime({
            sessionId: 'transfer',
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 }, teamId: 'A' }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1, teamId: 'A' }),
                ],
                flagCarrierId: 'player-1',
                pendingFlagTransfer: {
                    requesterId: 'player-1',
                    receiverId: 'player-2',
                    kind: 'offer',
                },
            }),
        });
        transferRuntime.turnState.actionTaken = true;
        harness.getPrivateState().sessions.set('transfer', transferRuntime);

        expect(harness.service.endTurn('transfer', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(transferRuntime);
        expect(transferRuntime.match.pendingFlagTransfer).toBeNull();
        expect(emitSnapshotSpy).toHaveBeenCalled();
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

    it('declares a team victory when the flag carrier returns to the starting tile', () => {
        const privateState = harness.getPrivateState();
        const runtime = makeRuntime({
            sessionId: 'ctf-win',
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeMatchPlayer({
                        id: 'player-1', position: { x: 1, y: 0 }, startingPosition: { x: 0, y: 0 }, teamId: 'A', name: 'Alice',
                    }),
                    makeMatchPlayer({
                        id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1, teamId: 'A', name: 'Bob',
                    }),
                    makeMatchPlayer({
                        id: 'player-3', position: { x: 2, y: 2 }, startingPosition: { x: 2, y: 2 }, avatarId: 2, teamId: 'B', name: 'Cara',
                    }),
                    makeMatchPlayer({
                        id: 'player-4', position: { x: 2, y: 1 }, startingPosition: { x: 2, y: 1 }, avatarId: 3, teamId: 'B', name: 'Dan',
                    }),
                ],
                flagCarrierId: 'player-1',
            }),
        });

        privateState.sessions.set('ctf-win', runtime);
        expect(harness.service.movePlayer('ctf-win', 'player-1', 'left')).toBe(true);
        expect(runtime.match.endState?.winnerKind).toBe('team');
        expect(runtime.match.endState?.winnerTeamId).toBe('A');
        expect(runtime.match.endState?.message).toContain('L equipe A remporte la partie');
        expect(privateState.sessions.has('ctf-win')).toBe(false);
    });
});
