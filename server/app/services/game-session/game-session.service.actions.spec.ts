/* eslint-disable max-lines */
import { ChatMessage } from '@common/chat/chat.interface';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { GameMode, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import {
    createGameSessionServiceHarness,
    makeMatch,
    makeMatchPlayer,
    makeObject,
    makeRuntime,
    MOVEMENT_POINTS_AFTER_MOVE,
} from './game-session.service.spec-helpers';
import { ARENA_BUFF_TURNS, SANCTUARY_COOLDOWN_TURNS } from '@app/utilities/game/game.constants';

describe('GameSessionService actions', () => {
    const harness = createGameSessionServiceHarness();
    const REGEN_SANCTUARY_ID = 9;
    const ARENA_SANCTUARY_ID = 11;
    const DAMAGED_PLAYER_HEALTH = 4;
    const HEALED_PLAYER_HEALTH = 6;
    const PRIVATE_COMBAT_LOG_COUNT = 4;

    it('toggles debug mode only for the organizer', () => {
        const runtime = makeRuntime();
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.toggleDebugMode('session-1', 'player-2')).toBe(false);
        expect(harness.service.toggleDebugMode('session-1', 'player-1')).toBe(true);
        expect(runtime.match.debugMode).toBe(true);
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('active le mode de debogage');
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

    it('teleports the active player in debug mode only to valid free cells', () => {
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

        runtime.turnState.activePlayerId = 'player-2';
        expect(harness.service.debugTeleportPlayer('session-1', 'player-2', { x: 2, y: 1 })).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-2')?.position).toEqual({ x: 2, y: 1 });
        runtime.turnState.activePlayerId = 'player-1';
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 9, y: 9 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 1, y: 0 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 2 })).toBe(false);
        expect(harness.service.debugTeleportPlayer('session-1', 'player-1', { x: 2, y: 0 })).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.position).toEqual({ x: 2, y: 0 });
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
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('ouvre une porte');
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
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('obtient le drapeau');
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
        expect(pickupRuntime.messages).toHaveLength(0);
        expect(pickupRuntime.logEntries.at(-1)?.entry.content).toContain('ramasse le drapeau');

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
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set(runtime.sessionId, runtime);

        expect(harness.service.startCombat('missing', 'player-1', 'player-2')).toBe(false);
        expect(harness.service.startCombat('session-1', 'player-2', 'player-1')).toBe(false);
        expect(harness.service.startCombat('session-1', 'player-1', 'player-2')).toBe(true);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.combatWins).toBe(2);
        expect(runtime.logEntries.at(-1)?.visibleToPlayerIds).toEqual(['player-1', 'player-2']);
        expect(runtime.logEntries.at(-1)?.entry.involvedPlayers).toEqual(['Alice', 'Bob']);
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
                    makeMatchPlayer({ id: 'player-2', name: 'Bob', position: { x: 1, y: 0 }, avatarId: 1 }),
                ],
            }),
        });
        privateState.sessions.set('winner', winnerRuntime);
        expect(harness.service.startCombat('winner', 'player-1', 'player-2')).toBe(true);
        expect(privateState.sessions.has('winner')).toBe(false);
    });
    it('adds detailed private combat logs only for the involved players', () => {
        const serviceInternals = harness.getServiceInternals();
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);
        const runtime = makeRuntime({
            socketToPlayerId: new Map([
                ['socket-1', 'player-1'],
                ['socket-2', 'player-2'],
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
        const statistics: CombatPlayerStatistics[] = [
            {
                attacker: { id: 'player-1', health: 6 },
                victim: { id: 'player-2', health: 4 },
                attackRoll: 3,
                defenseRoll: 2,
                attack: 10,
                defense: 7,
                attackBaseValue: 4,
                attackPostureBonus: 2,
                attackSanctuaryBonus: 1,
                attackPenalty: 0,
                defenseBaseValue: 4,
                defensePostureBonus: 0,
                defenseSanctuaryBonus: 1,
                defensePenalty: 0,
                damageDealt: 3,
            },
            {
                attacker: { id: 'player-2', health: 4 },
                victim: { id: 'player-1', health: 6 },
                attackRoll: 1,
                defenseRoll: 4,
                attack: 5,
                defense: 10,
                attackBaseValue: 4,
                attackPostureBonus: 0,
                attackSanctuaryBonus: 0,
                attackPenalty: 0,
                defenseBaseValue: 4,
                defensePostureBonus: 2,
                defenseSanctuaryBonus: 0,
                defensePenalty: 0,
                damageDealt: 0,
            },
        ];
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);

        harness.service.appendCombatRoundLogs(runtime.sessionId, statistics);

        expect(runtime.logEntries).toHaveLength(PRIVATE_COMBAT_LOG_COUNT);
        expect(runtime.logEntries.every((entry) => entry.visibleToPlayerIds?.sort().join(',') === 'player-1,player-2')).toBe(true);
        expect(runtime.logEntries[0].entry.content).toContain('Calcul detaille pour attaque');
        expect(runtime.logEntries[0].entry.content).toContain('Calcul detaille pour attaque de Alice');
        expect(runtime.logEntries[0].entry.content).toContain('Calcul detaille pour attaque de Bob');
        expect(runtime.logEntries[1].entry.content).toContain('Calcul detaille pour defense');
        expect(runtime.logEntries[1].entry.content).toContain('Calcul detaille pour defense de Bob');
        expect(runtime.logEntries[1].entry.content).toContain('Calcul detaille pour defense de Alice');
        expect(runtime.logEntries[2].entry.content).toContain("Difference entre l'attaque de Alice et la defense de Bob");
        expect(runtime.logEntries[3].entry.content).toContain("Resultat de l'attaque de Alice contre Bob : 3 degats");
        expect(runtime.logEntries[3].entry.content).toContain("Resultat de l'attaque de Bob contre Alice : aucun degat");
        expect(harness.service.getSnapshotForSocket(runtime.sessionId, 'socket-1')?.logEntries).toHaveLength(PRIVATE_COMBAT_LOG_COUNT);
        expect(harness.service.getSnapshotForSocket(runtime.sessionId, 'socket-2')?.logEntries).toHaveLength(PRIVATE_COMBAT_LOG_COUNT);
        expect(harness.service.getSnapshotForSocket(runtime.sessionId, 'socket-3')?.logEntries).toHaveLength(0);
        expect(emitSnapshotSpy).toHaveBeenCalledWith(runtime);
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
        expect(runtime.match.endState?.message).toContain("L'équipe A remporte la partie");
        expect(privateState.sessions.has('ctf-win')).toBe(false);
    });

    it('opens a pending sanctuary choice and resolves healing on the server', () => {
        const sanctuary = makeObject({ id: REGEN_SANCTUARY_ID, type: ObjectType.REGEN, position: { x: 1, y: 0 }, size: ObjectSize.L });
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, health: DAMAGED_PLAYER_HEALTH }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 2 }, avatarId: 1 }),
                ],
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 2, y: 2 } }),
                    sanctuary,
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 2, y: 2 } }),
                    sanctuary,
                ],
                sanctuaryStates: [{ objectId: REGEN_SANCTUARY_ID, cooldownTurnsRemaining: 0 }],
            }),
        });
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        const emitSnapshotSpy = jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.useSanctuary('session-1', 'player-1', REGEN_SANCTUARY_ID)).toBe(true);
        expect(runtime.match.pendingSanctuaryChoice).toEqual({ playerId: 'player-1', objectId: REGEN_SANCTUARY_ID });
        expect(harness.service.endTurn('session-1', 'player-1')).toBe(false);

        expect(harness.service.resolveSanctuaryChoice('session-1', 'player-1', 'normal')).toBe(true);
        expect(runtime.match.pendingSanctuaryChoice).toBeNull();
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.health).toBe(HEALED_PLAYER_HEALTH);
        expect(runtime.match.sanctuaryStates?.find((state) => state.objectId === REGEN_SANCTUARY_ID)?.cooldownTurnsRemaining)
            .toBe(SANCTUARY_COOLDOWN_TURNS);
        expect(runtime.turnState.actionTaken).toBe(true);
        expect(runtime.logEntries.at(-1)?.entry.content).toContain('utilise un sanctuaire');
        expect(emitSnapshotSpy).toHaveBeenCalledTimes(2);
    });

    it('cancels a sanctuary choice without consuming the action', () => {
        const sanctuary = makeObject({ id: REGEN_SANCTUARY_ID, type: ObjectType.REGEN, position: { x: 1, y: 0 }, size: ObjectSize.L });
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({ id: 'player-1', position: { x: 0, y: 0 }, health: DAMAGED_PLAYER_HEALTH }),
                    makeMatchPlayer({ id: 'player-2', position: { x: 2, y: 2 }, avatarId: 1 }),
                ],
                objects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 2, y: 2 } }),
                    sanctuary,
                ],
                allObjects: [
                    makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 } }),
                    makeObject({ id: 2, type: ObjectType.START, position: { x: 2, y: 2 } }),
                    sanctuary,
                ],
                sanctuaryStates: [{ objectId: REGEN_SANCTUARY_ID, cooldownTurnsRemaining: 0 }],
            }),
        });
        const serviceInternals = harness.getServiceInternals();
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        jest.spyOn(serviceInternals, 'emitSnapshot').mockImplementation((() => undefined) as never);

        expect(harness.service.useSanctuary('session-1', 'player-1', REGEN_SANCTUARY_ID)).toBe(true);
        expect(harness.service.resolveSanctuaryChoice('session-1', 'player-1', 'cancel')).toBe(true);
        expect(runtime.match.pendingSanctuaryChoice).toBeNull();
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.health).toBe(DAMAGED_PLAYER_HEALTH);
        expect(runtime.turnState.actionTaken).toBe(false);
        expect(runtime.logEntries).toHaveLength(0);
    });

    it('ticks arena sanctuary cooldowns and temporary buffs when turns advance', () => {
        const serviceInternals = harness.getServiceInternals();
        const runtime = makeRuntime({
            match: makeMatch({
                players: [
                    makeMatchPlayer({
                        id: 'player-1',
                        attackBonus: 1,
                        defenseBonus: 1,
                        arenaBuffTurnsRemaining: ARENA_BUFF_TURNS,
                    }),
                    makeMatchPlayer({ id: 'player-2', avatarId: 1 }),
                ],
                sanctuaryStates: [{ objectId: ARENA_SANCTUARY_ID, cooldownTurnsRemaining: SANCTUARY_COOLDOWN_TURNS }],
            }),
        });
        harness.getPrivateState().sessions.set(runtime.sessionId, runtime);
        jest.spyOn(serviceInternals, 'startTransition').mockImplementation((() => undefined) as never);

        runtime.turnState.activePlayerId = 'player-1';
        serviceInternals.advanceToNextTurn(runtime);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.arenaBuffTurnsRemaining).toBe(ARENA_BUFF_TURNS - 1);
        expect(runtime.match.sanctuaryStates?.[0].cooldownTurnsRemaining).toBe(SANCTUARY_COOLDOWN_TURNS - 1);

        runtime.turnState.activePlayerId = 'player-2';
        serviceInternals.advanceToNextTurn(runtime);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.arenaBuffTurnsRemaining).toBe(ARENA_BUFF_TURNS - 1);
        expect(runtime.match.sanctuaryStates?.[0].cooldownTurnsRemaining).toBe(SANCTUARY_COOLDOWN_TURNS - 2);

        runtime.turnState.activePlayerId = 'player-1';
        serviceInternals.advanceToNextTurn(runtime);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.arenaBuffTurnsRemaining).toBe(0);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.attackBonus).toBe(0);
        expect(runtime.match.players.find((player) => player.id === 'player-1')?.defenseBonus).toBe(0);
        expect(runtime.match.sanctuaryStates?.[0].cooldownTurnsRemaining).toBe(0);
    });
});
