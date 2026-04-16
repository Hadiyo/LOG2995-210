import { NotFoundException } from '@nestjs/common';
import {
    createGameSessionServiceHarness,
    makeLobbyPlayer,
    makeMatch,
    makeMatchPlayer,
    makeMapDetails,
    makeObject,
    makeRuntime,
    makeTurnState,
    runtimeModule,
} from './game-session.service.spec-helpers';
import { GameMode, ObjectType } from '@common/maps/map.enums';

describe('GameSessionService lifecycle', () => {
    const harness = createGameSessionServiceHarness();

    it('creates a session from a waiting room, emits a snapshot, and starts transitions', async () => {
        const runtime = makeRuntime();
        const serviceInternals = harness.getServiceInternals();
        const privateState = harness.getPrivateState();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);
        const startTransitionSpy = jest.spyOn(serviceInternals, 'startTransition').mockImplementation((() => undefined) as never);
        jest.spyOn(runtimeModule, 'buildSession').mockReturnValue(runtime);
        harness.mapService.getMapByIdForEditor.mockResolvedValue(makeMapDetails());

        const sessionId = await harness.service.createSessionFromWaitingRoom('map-1', [makeLobbyPlayer()], []);

        expect(sessionId).toBe('session-1');
        expect(harness.mapService.getMapByIdForEditor).toHaveBeenCalledWith('map-1');
        expect(privateState.sessions.get('session-1')).toBe(runtime);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
        expect(startTransitionSpy).toHaveBeenCalledWith(runtime);
    });

    it('adds a global log entry when a turn starts', async () => {
        harness.mapService.getMapByIdForEditor.mockResolvedValue(makeMapDetails());

        const sessionId = await harness.service.createSessionFromWaitingRoom('map-1', [makeLobbyPlayer()]);
        const runtime = harness.getPrivateState().sessions.get(sessionId);

        expect(runtime?.logEntries).toHaveLength(0);
        jest.advanceTimersByTime(runtimeModule.TRANSITION_DURATION_MS);

        expect(runtime?.logEntries.at(-1)?.entry.content).toContain('Debut du tour de');
    });

    it('registers sockets and resolves socket lookups', () => {
        const runtime = makeRuntime();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        const snapshot = harness.service.registerSocket('session-1', 'player-1', 'socket-1');

        expect(snapshot).toEqual({
            snapshot: {
                sessionId: runtime.sessionId,
                match: runtime.match,
                turnState: runtime.turnState,
                messages: runtime.messages,
                logEntries: [],
            },
            previousSessionId: null,
        });
        expect(harness.service.getPlayerIdForSocket('socket-1', 'session-1')).toBe('player-1');
        expect(harness.service.getPlayerNameForSocket('socket-1', 'session-1')).toBe('Alice');
        expect(harness.service.findSessionIdForSocket('socket-1')).toBe('session-1');
        expect(() => harness.service.registerSocket('missing', 'player-1', 'socket-x')).toThrow(NotFoundException);
        expect(() => harness.service.registerSocket('session-1', 'ghost-player', 'socket-y')).toThrow(NotFoundException);
    });

    it('rejects socket registration attempts for virtual players', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({
                        id: 'player-1',
                        controller: 'virtual',
                        virtualProfile: 'aggressive',
                    }),
                    makeMatchPlayer({ id: 'player-2', avatarId: 1 }),
                ],
            }),
        });
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        expect(() => harness.service.registerSocket('session-1', 'player-1', 'socket-bot')).toThrow(NotFoundException);
        expect(harness.service.findSessionIdForSocket('socket-bot')).toBeNull();
    });

    it('filters journal entries per socket when a log is private', () => {
        const runtime = makeRuntime({
            logEntries: [
                {
                    entry: {
                        id: 'public-log',
                        author: 'Journal',
                        content: 'Alice ramasse le drapeau.',
                        createdAt: '2026-01-01T00:00:00.000Z',
                        involvedPlayers: ['Alice'],
                    },
                    visibleToPlayerIds: null,
                },
                {
                    entry: {
                        id: 'private-log',
                        author: 'Journal',
                        content: 'Alice remporte un combat contre Bob.',
                        createdAt: '2026-01-01T00:00:01.000Z',
                        involvedPlayers: ['Alice', 'Bob'],
                    },
                    visibleToPlayerIds: ['player-1', 'player-2'],
                },
            ],
            socketToPlayerId: new Map([
                ['socket-1', 'player-1'],
                ['socket-3', 'player-3'],
            ]),
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 } }),
                ],
            }),
        });
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        const attackerSnapshot = harness.service.getSnapshotForSocket('session-1', 'socket-1');
        const outsiderSnapshot = harness.service.getSnapshotForSocket('session-1', 'socket-3');

        expect(attackerSnapshot?.logEntries.map((entry) => entry.id)).toEqual(['public-log', 'private-log']);
        expect(outsiderSnapshot?.logEntries.map((entry) => entry.id)).toEqual(['public-log']);
    });

    it('moves a socket membership to the latest joined session', () => {
        const firstRuntime = makeRuntime();
        const secondRuntime = makeRuntime({
            sessionId: 'session-2',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-4', name: 'Dan', avatarId: 3 }),
                ],
            }),
        });
        const privateState = harness.getPrivateState();
        privateState.sessions.set(firstRuntime.sessionId, firstRuntime);
        privateState.sessions.set(secondRuntime.sessionId, secondRuntime);

        harness.service.registerSocket('session-1', 'player-1', 'socket-1');
        const secondSnapshot = harness.service.registerSocket('session-2', 'player-3', 'socket-1');

        expect(secondSnapshot.previousSessionId).toBe('session-1');
        expect(privateState.sessions.has('session-1')).toBe(false);
        expect(secondRuntime.socketToPlayerId.get('socket-1')).toBe('player-3');
    });

    it('removes sockets and keeps a player active when another socket is still linked', () => {
        const runtime = makeRuntime({
            socketToPlayerId: new Map([
                ['socket-1', 'player-1'],
                ['socket-2', 'player-1'],
            ]),
        });
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        expect(harness.service.removeSocket('missing')).toBeNull();
        expect(harness.service.removeSocket('socket-1')).toBeNull();
        expect(harness.service.removeSocket('socket-2')).toEqual({
            sessionId: 'session-1',
            playerId: 'player-1',
        });
    });

    it('ends the active turn only for the active player', () => {
        const runtime = makeRuntime();
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const advanceSpy = jest.spyOn(serviceInternals, 'advanceToNextTurn').mockImplementation((() => undefined) as never);

        expect(harness.service.endTurn('missing', 'player-1')).toBe(false);
        expect(harness.service.endTurn('session-1', 'player-2')).toBe(false);
        expect(harness.service.endTurn('session-1', 'player-1')).toBe(true);
        expect(advanceSpy).toHaveBeenCalledWith(runtime);
    });

    it('handles surrender for empty, final, active, and inactive roster changes', () => {
        const serviceInternals = harness.getServiceInternals();
        const privateState = harness.getPrivateState();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);
        const startTransitionSpy = jest.spyOn(serviceInternals, 'startTransition').mockImplementation((() => undefined) as never);

        const emptyRuntime = makeRuntime({
            match: makeMatch({ players: [makeMatchPlayer({ id: 'player-1' })] }),
            turnState: makeTurnState({
                order: [{ playerId: 'player-1', speed: 4 }],
                playerStates: [{ playerId: 'player-1', state: 'active' }],
            }),
        });
        privateState.sessions.set('empty', emptyRuntime);
        expect(harness.service.surrender('empty', 'player-1')).toBe(true);
        expect(privateState.sessions.has('empty')).toBe(false);

        const finalRuntime = makeRuntime({
            sessionId: 'final',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set('final', finalRuntime);
        expect(harness.service.surrender('final', 'player-1')).toBe(true);
        expect(finalRuntime.match.endState?.winnerKind).toBe('none');
        expect(privateState.sessions.has('final')).toBe(false);

        const activeRuntime = makeRuntime({
            sessionId: 'active',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true, position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1, position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 } }),
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 } }),
                ],
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allStartingPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
            }),
            turnState: makeTurnState({
                activePlayerId: 'player-1',
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                    { playerId: 'player-3', speed: 2 },
                ],
                playerStates: [
                    { playerId: 'player-1', state: 'active' },
                    { playerId: 'player-2', state: 'waiting' },
                    { playerId: 'player-3', state: 'waiting' },
                ],
            }),
        });
        privateState.sessions.set('active', activeRuntime);
        expect(harness.service.surrender('active', 'player-1')).toBe(true);
        expect(startTransitionSpy).toHaveBeenCalledWith(activeRuntime);

        const inactiveRuntime = makeRuntime({
            sessionId: 'inactive',
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', name: 'Alice', isOrganizer: true, position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 } }),
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', avatarId: 1, position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 } }),
                    makeMatchPlayer({ id: 'player-3', name: 'Cara', avatarId: 2, position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 } }),
                ],
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 1, y: 0 } }),
                    makeObject({ id: 4, type: ObjectType.START, position: { x: 2, y: 0 } }),
                ],
                allStartingPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
            }),
            turnState: makeTurnState({
                activePlayerId: 'player-1',
                order: [
                    { playerId: 'player-1', speed: 4 },
                    { playerId: 'player-2', speed: 3 },
                    { playerId: 'player-3', speed: 2 },
                ],
                playerStates: [
                    { playerId: 'player-1', state: 'active' },
                    { playerId: 'player-2', state: 'waiting' },
                    { playerId: 'player-3', state: 'waiting' },
                ],
            }),
        });
        privateState.sessions.set('inactive', inactiveRuntime);
        expect(harness.service.surrender('inactive', 'player-2')).toBe(true);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(inactiveRuntime);
        expect(harness.service.surrender('missing', 'player-1')).toBe(false);
        expect(harness.service.surrender('inactive', 'ghost')).toBe(false);
    });

    it('refuses surrender requests for virtual players', () => {
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({
                        id: 'player-1',
                        name: 'Bot agressif',
                        controller: 'virtual',
                        virtualProfile: 'aggressive',
                    }),
                    makeMatchPlayer({ id: 'player-2', name: 'Alice', avatarId: 1 }),
                ],
            }),
        });

        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        expect(harness.service.surrender('session-1', 'player-1')).toBe(false);
        expect(harness.getPrivateState().sessions.has(runtime.sessionId)).toBe(true);
    });

    it('cancels a CTF match when a team has no remaining players after abandons', () => {
        const privateState = harness.getPrivateState();
        const runtime = makeRuntime({
            sessionId: 'ctf-cancel',
            match: makeMatch({
                mode: GameMode.CTF,
                players: [
                    makeMatchPlayer({
                        id: 'player-1', name: 'Alice', isOrganizer: true, teamId: 'A', position: { x: 0, y: 0 }, startingPosition: { x: 0, y: 0 },
                    }),
                    makeMatchPlayer({
                        id: 'player-2', name: 'Bob', avatarId: 1, teamId: 'B', position: { x: 1, y: 0 }, startingPosition: { x: 1, y: 0 },
                    }),
                    makeMatchPlayer({
                        id: 'player-3', name: 'Cara', avatarId: 2, teamId: 'B', position: { x: 2, y: 0 }, startingPosition: { x: 2, y: 0 },
                    }),
                ],
            }),
        });

        privateState.sessions.set('ctf-cancel', runtime);
        expect(harness.service.surrender('ctf-cancel', 'player-1')).toBe(true);
        expect(runtime.match.endState?.winnerKind).toBe('none');
        expect(runtime.match.endState?.message).toContain("La partie est annulée: l'équipe A n'a plus aucun joueur");
        expect(privateState.sessions.has('ctf-cancel')).toBe(false);
    });
});
