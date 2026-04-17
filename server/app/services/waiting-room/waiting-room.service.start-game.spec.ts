import { GameMode, MapSize } from '@common/maps/map.enums';
import { WaitingRoomEvents } from '@common/socket-events';
import {
    createWaitingRoomServiceHarness,
    makeLobbyPlayer,
    makeMap,
} from './waiting-room.service.spec-helpers';

describe('WaitingRoomService start game', () => {
    const harness = createWaitingRoomServiceHarness();

    it('starts a game only when the organizer and roster are valid', async () => {
        const onError = jest.fn();
        const onStarted = jest.fn();
        const onDirectory = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomError, onError);
        harness.service.on(WaitingRoomEvents.WaitingRoomGameStarted, onStarted);
        harness.service.on(WaitingRoomEvents.WaitingRoomDirectoryUpdated, onDirectory);
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        harness.gameSessionService.createSessionFromWaitingRoom.mockResolvedValue('session-99');
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        await harness.service.startGame('socket-2', accessCode);
        await harness.service.startGame('socket-org', accessCode);

        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });
        await harness.service.startGame('socket-org', accessCode);

        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-2',
            payload: { message: "Seul l'organisateur peut lancer la partie." },
        });
        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-org',
            payload: { message: 'Il faut au moins 2 joueurs pour demarrer.' },
        });
        expect(harness.gameSessionService.createSessionFromWaitingRoom).toHaveBeenCalledWith(
            'map-1',
            expect.arrayContaining([
                expect.objectContaining({ id: 'player-1' }),
                expect.objectContaining({ id: 'player-2' }),
            ]),
            [],
        );
        expect(onStarted).toHaveBeenCalledWith({
            accessCode,
            sessionId: 'session-99',
            messages: [],
        });
        expect(harness.service['rooms'].has(accessCode)).toBe(false);
        expect(onDirectory).toHaveBeenCalled();
    });

    it('starts a waiting room only once even when requested twice quickly', async () => {
        const onStarted = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomGameStarted, onStarted);
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));

        let resolveSessionCreation: ((sessionId: string) => void) | undefined;
        harness.gameSessionService.createSessionFromWaitingRoom.mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolveSessionCreation = resolve;
                }),
        );

        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        const firstStart = harness.service.startGame('socket-org', accessCode);
        const secondStart = harness.service.startGame('socket-org', accessCode);

        expect(harness.gameSessionService.createSessionFromWaitingRoom).toHaveBeenCalledTimes(1);
        expect(harness.service.getWaitingRoomState(accessCode)).toEqual(expect.objectContaining({
            accessCode,
            isLocked: true,
        }));

        resolveSessionCreation?.('session-99');
        await Promise.all([firstStart, secondStart]);

        expect(onStarted).toHaveBeenCalledTimes(1);
        expect(onStarted).toHaveBeenCalledWith({
            accessCode,
            sessionId: 'session-99',
            messages: [],
        });
    });

    it('rejects CTF game start when the roster size is odd', async () => {
        const onError = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomError, onError);
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M, mode: GameMode.CTF }));

        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });
        harness.service.joinWaitingRoom('socket-3', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-3', name: 'Cara', avatarId: 2 }),
        });

        await harness.service.startGame('socket-org', accessCode);

        expect(harness.gameSessionService.createSessionFromWaitingRoom).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-org',
            payload: { message: 'Une partie CTF exige un nombre pair de joueurs.' },
        });
        expect(harness.service.getWaitingRoomState(accessCode)).toEqual(expect.objectContaining({
            accessCode,
            isLocked: false,
        }));
    });

    it('cancels a started room cleanly if the organizer leaves during session creation', async () => {
        const onCancelled = jest.fn();
        const onStarted = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomCancelled, onCancelled);
        harness.service.on(WaitingRoomEvents.WaitingRoomGameStarted, onStarted);
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));

        let resolveSessionCreation: ((sessionId: string) => void) | undefined;
        harness.gameSessionService.createSessionFromWaitingRoom.mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolveSessionCreation = resolve;
                }),
        );

        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        const startPromise = harness.service.startGame('socket-org', accessCode);
        harness.service.leaveWaitingRoom('socket-org', accessCode);

        resolveSessionCreation?.('session-99');
        await startPromise;

        expect(onCancelled).toHaveBeenCalledWith({ accessCode });
        expect(onStarted).not.toHaveBeenCalled();
        expect(harness.gameSessionService.destroySession).toHaveBeenCalledWith('session-99');
        expect(harness.service.getWaitingRoomState(accessCode)).toBeNull();
    });

    it('finds the access code for a socket and disconnects through leaveWaitingRoom', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });
        const leaveSpy = jest.spyOn(harness.service, 'leaveWaitingRoom');

        expect(harness.service.getAccessCodeForSocket('socket-2')).toBe(accessCode);

        harness.service.handleDisconnect('socket-2');

        expect(leaveSpy).toHaveBeenCalledWith('socket-2', accessCode);
    });
});
