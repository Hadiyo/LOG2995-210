import { ChatMessage } from '@common/chat/chat.interface';
import { GameMode, ObjectType, TileType } from '@common/maps/map.enums';
import {
    createGameSessionServiceHarness,
    findPlayer,
    makeCtfPlayer,
    makeMatch,
    makeMatchPlayer,
    makeObject,
    makeRuntime,
    makeSessionObjects,
    MOVEMENT_POINTS_AFTER_MOVE,
} from './game-session.service.spec-helpers';

const DEFAULT_STARTS = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
const registerRuntime = (runtime: ReturnType<typeof makeRuntime>, harness: ReturnType<typeof createGameSessionServiceHarness>) => {
    harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
    return runtime;
};
const spyOnEmitSnapshot = (harness: ReturnType<typeof createGameSessionServiceHarness>) =>
    jest.spyOn(harness.getServiceInternals(), 'emitSnapshot').mockImplementation((() => undefined) as never);

describe('GameSessionService actions', () => {
    const harness = createGameSessionServiceHarness();

    it('toggles debug mode only for the organizer', () => {
        const runtime = registerRuntime(makeRuntime(), harness);
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        expect(harness.service.toggleDebugMode('session-1', 'player-2')).toBe(false);
        expect(harness.service.toggleDebugMode('session-1', 'player-1')).toBe(true);
        expect(runtime.match.debugMode).toBe(true);
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('active le mode de debogage');
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('forces debug turn ends only in valid debug sessions', () => {
        const runtime = registerRuntime(makeRuntime({ match: makeMatch({ debugMode: true }) }), harness);
        const advanceSpy = jest.spyOn(harness.getServiceInternals(), 'advanceToNextTurn').mockImplementation((() => undefined) as never);

        expect(harness.service.forceEndDebugTurn('session-1', 'player-2')).toBe(false);
        expect(harness.service.forceEndDebugTurn('session-1', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(runtime);
    });

    it('teleports the active player in debug mode only to valid free cells', () => {
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                debugMode: true,
                ...makeSessionObjects(DEFAULT_STARTS, makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 2, y: 2 } })),
            }),
        }), harness);
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        runtime.turnState.activePlayerId = 'player-2';
        expect(harness.service.debugTeleportPlayer('session-1', 'player-2', { x: 2, y: 1 })).toBe(true);
        expect(findPlayer(runtime, 'player-2')?.position).toEqual({ x: 2, y: 1 });

        runtime.turnState.activePlayerId = 'player-1';
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 9, y: 9 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 1, y: 0 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 0 })).toBe(true);
        expect(findPlayer(runtime, 'player-1')?.position).toEqual({ x: 2, y: 0 });
        expect(findPlayer(runtime, 'player-1')?.render?.facing).toBe('right');
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('adds chat messages only to known sessions', () => {
        const runtime = registerRuntime(makeRuntime(), harness);
        const message: ChatMessage = { id: 'msg-1', author: 'Alice', content: 'hello', createdAt: '2026-01-01T00:00:00.000Z' };
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        expect(harness.service.addChatMessage('missing', message)).toBeNull();
        expect(harness.service.addChatMessage('session-1', message)).toEqual(message);
        expect(runtime.messages).toEqual([message]);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('moves the active player only when the destination is valid and affordable', () => {
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        }), harness);
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        expect(harness.service.movePlayer('missing', 'player-1', 'right')).toBe(false);
        expect(harness.service.movePlayer('session-1', 'player-2', 'right')).toBe(false);

        runtime.turnState.movementPointsRemaining = 0;
        expect(harness.service.movePlayer('session-1', 'player-1', 'right')).toBe(false);

        runtime.turnState.movementPointsRemaining = 4;
        expect(harness.service.movePlayer('session-1', 'player-1', 'right')).toBe(true);
        expect(findPlayer(runtime, 'player-1')?.position).toEqual({ x: 1, y: 0 });
        expect(findPlayer(runtime, 'player-1')?.render).toMatchObject({ facing: 'right', pose: 'walk', poseDurationMs: 180 });
        expect(runtime.turnState.movementPointsRemaining).toBe(MOVEMENT_POINTS_AFTER_MOVE);
        expect(runtime.turnState.movementCount).toBe(1);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('toggles adjacent doors and consumes the player action', () => {
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 0 }, startingPosition: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        }), harness);
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        expect(harness.service.toggleDoor('session-1', 'player-2', { x: 0, y: 1 })).toBe(false);
        expect(harness.service.toggleDoor('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(harness.service.toggleDoor('session-1', 'player-1', { x: 0, y: 1 })).toBe(true);
        expect(runtime.match.map.find((cell) => cell.position.x === 0 && cell.position.y === 1)?.isWalkable).toBe(true);
        expect(findPlayer(runtime, 'player-1')?.render).toMatchObject({ facing: 'front', pose: 'attack', poseDurationMs: 220 });
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('ouvre une porte');
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
    });

    it('refuses to close a door when the flag is on that tile in CTF', () => {
        registerRuntime(makeRuntime({
            match: makeMatch({
                mode: GameMode.CTF,
                map: [
                    { position: { x: 0, y: 0 }, tileType: TileType.DIRT, isWalkable: true, isOccupied: false },
                    { position: { x: 0, y: 1 }, tileType: TileType.DOOR, isWalkable: true, isOccupied: false },
                ],
                players: [
                    makeCtfPlayer('player-1', 'A', { x: 0, y: 0 }),
                    makeCtfPlayer('player-2', 'B', { x: 2, y: 0 }, { avatarId: 1 }),
                ],
                ...makeSessionObjects([], makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 0, y: 1 } })),
            }),
        }), harness);

        expect(harness.service.toggleDoor('session-1', 'player-1', { x: 0, y: 1 })).toBe(false);
    });

    it('requests and resolves a flag transfer between adjacent teammates in CTF', () => {
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeCtfPlayer('player-1', 'A', { x: 0, y: 0 }),
                    makeCtfPlayer('player-2', 'A', { x: 1, y: 0 }, { avatarId: 1 }),
                ],
                flagCarrierId: 'player-1',
            }),
        }), harness);

        expect(harness.service.requestFlagTransfer('session-1', 'player-1', 'player-2')).toBe(true);
        expect(runtime.match.pendingFlagTransfer).toEqual({ requesterId: 'player-1', receiverId: 'player-2', kind: 'offer' });
        expect(runtime.turnState.actionTaken).toBe(true);

        expect(harness.service.resolveFlagTransfer('session-1', 'player-2', true)).toBe(true);
        expect(runtime.match.pendingFlagTransfer).toBeNull();
        expect(runtime.match.flagCarrierId).toBe('player-2');
        expect(runtime.messages.at(-1)?.content).toContain('obtient le drapeau');
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('obtient le drapeau');
        expect(emitSnapshotSpy).toHaveBeenCalled();
    });

    it('auto-accepts a flag transfer offered to a virtual teammate and refuses virtual requests', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 }, teamId: 'A' }),
                    makeMatchPlayer({
                        id: 'player-2',
                        position: { x: 1, y: 0 },
                        startingPosition: { x: 1, y: 0 },
                        avatarId: 1,
                        teamId: 'A',
                        controller: 'virtual',
                        virtualProfile: 'aggressive',
                    }),
                ],
                flagCarrierId: 'player-1',
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        expect(harness.service.requestFlagTransfer('session-1', 'player-1', 'player-2')).toBe(true);
        expect(runtime.match.pendingFlagTransfer).toBeNull();
        expect(runtime.match.flagCarrierId).toBe('player-2');
        expect(runtime.messages.at(-1)?.content).toContain('obtient le drapeau');

        runtime.turnState.actionTaken = false;
        runtime.match.flagCarrierId = 'player-2';
        expect(harness.service.requestFlagTransfer('session-1', 'player-2', 'player-1')).toBe(false);
    });

    it('logs flag pickup and clears unanswered transfers when the turn advances', () => {
        const serviceInternals = harness.getServiceInternals();
        const advanceSpy = jest.spyOn(serviceInternals, 'advanceToNextTurn');
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);

        const pickupRuntime = registerRuntime(makeRuntime({
            sessionId: 'pickup',
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeCtfPlayer('player-1', 'A', { x: 0, y: 0 }),
                    makeCtfPlayer('player-2', 'B', { x: 2, y: 0 }, { avatarId: 1 }),
                ],
                ...makeSessionObjects([], makeObject({ id: 3, type: ObjectType.FLAG, position: { x: 1, y: 0 } })),
                flagCarrierId: null,
            }),
        }), harness);
        expect(harness.service.movePlayer('pickup', 'player-1', 'right')).toBe(true);
        expect(pickupRuntime.messages).toHaveLength(0);
        expect(pickupRuntime.logEntries.at(-1)?.entry.content).toContain('ramasse le drapeau');

        const transferRuntime = registerRuntime(makeRuntime({
            sessionId: 'transfer',
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeCtfPlayer('player-1', 'A', { x: 0, y: 0 }),
                    makeCtfPlayer('player-2', 'A', { x: 1, y: 0 }, { avatarId: 1 }),
                ],
                flagCarrierId: 'player-1',
                pendingFlagTransfer: { requesterId: 'player-1', receiverId: 'player-2', kind: 'offer' },
            }),
        }), harness);
        transferRuntime.turnState.actionTaken = true;

        expect(harness.service.endTurn('transfer', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(transferRuntime);
        expect(transferRuntime.match.pendingFlagTransfer).toBeNull();
        expect(emitSnapshotSpy).toHaveBeenCalled();
    });

    it('starts combat only for adjacent active players and finishes the match on the win threshold', () => {
        const privateState = harness.getPrivateState();
        const emitSnapshotSpy = spyOnEmitSnapshot(harness);
        const runtime = registerRuntime(makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, combatWins: 1, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        }), harness);

        expect(harness.service.startCombat('missing', 'player-1', 'player-2')).toBe(false);
        expect(harness.service.startCombat('session-1', 'player-2', 'player-1')).toBe(false);
        expect(harness.service.startCombat('session-1', 'player-1', 'player-2')).toBe(true);
        expect(findPlayer(runtime, 'player-1')?.combatWins).toBe(2);
        expect(runtime.logEntries.at(-1)?.visibleToPlayerIds).toEqual(['player-1', 'player-2']);
        expect(runtime.logEntries.at(-1)?.entry.involvedPlayers).toEqual(['Alice', 'Bob']);
        expect(findPlayer(runtime, 'player-1')?.render).toMatchObject({ facing: 'right', pose: 'attack', poseDurationMs: 220 });
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);

        registerRuntime(makeRuntime({
            sessionId: 'winner',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, combatWins: 2, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        }), harness);

        expect(harness.service.startCombat('winner', 'player-1', 'player-2')).toBe(true);
        expect(privateState.sessions.has('winner')).toBe(false);
    });
});
