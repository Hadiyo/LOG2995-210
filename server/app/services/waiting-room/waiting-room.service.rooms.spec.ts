import { ACCESS_CODE_LENGTH, MIN_PLAYERS_TO_START } from '@app/services/waiting-room/waiting-room.constants';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { WaitingRoomEvents } from '@common/socket-events';
import {
    createWaitingRoomServiceHarness,
    makeLobbyPlayer,
    makeMap,
    makeMapSummary,
} from './waiting-room.service.spec-helpers';

describe('WaitingRoomService rooms', () => {
    const harness = createWaitingRoomServiceHarness();

    it('creates a waiting room, marks the organizer, and emits updates', async () => {
        const onUpdated = jest.fn();
        const onDirectory = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomUpdated, onUpdated);
        harness.service.on(WaitingRoomEvents.WaitingRoomDirectoryUpdated, onDirectory);
        harness.mapService.getMapById.mockResolvedValue(makeMap());

        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        const room = harness.service['rooms'].get(accessCode);
        expect(room).toBeDefined();
        expect(room?.players[0]).toMatchObject({
            id: 'player-1',
            isOrganizer: true,
            controller: 'human',
        });
        expect(accessCode).toHaveLength(ACCESS_CODE_LENGTH);
        expect(onUpdated).toHaveBeenCalledWith({
            accessCode,
            payload: expect.objectContaining({
                accessCode,
                mapId: 'map-1',
                players: [expect.objectContaining({ id: 'player-1', isOrganizer: true })],
                minPlayersToStart: MIN_PLAYERS_TO_START,
            }),
        });
        expect(onDirectory).toHaveBeenCalledTimes(1);
    });

    it('moves an organizer socket out of its previous room before creating a new one', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap());

        const firstAccessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const secondAccessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        expect(harness.service.getWaitingRoomState(firstAccessCode)).toBeNull();
        expect(harness.service.getAccessCodeForSocket('socket-org')).toBe(secondAccessCode);
    });

    it('returns only joinable waiting room previews', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const openCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service['rooms'].set('LOCKED1', {
            accessCode: 'LOCKED1',
            mapId: 'map-2',
            mapMode: GameMode.CLASSIC,
            organizerSocketId: 'socket-2',
            players: [makeLobbyPlayer({ id: 'player-2' })],
            messages: [],
            socketToPlayerId: new Map([['socket-2', 'player-2']]),
            isLocked: true,
            isStarting: false,
            maxPlayers: 4,
        });
        harness.mapService.getAllMapsSummary.mockResolvedValue([
            makeMapSummary({ id: 'map-1', size: MapSize.M, name: 'Open room' }),
            makeMapSummary({ id: 'map-2', name: 'Locked room' }),
        ]);

        const previews = await harness.service.getAvailableWaitingRoomPreviews();

        expect(previews).toEqual([
            expect.objectContaining({
                accessCode: openCode,
                mapId: 'map-1',
                name: 'Open room',
                playerCount: 1,
                maxPlayers: 4,
            }),
        ]);
    });

    it('rejects joins for missing rooms, full rooms, and duplicate avatars', async () => {
        const onError = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomError, onError);
        harness.mapService.getMapById.mockResolvedValue(makeMap());

        expect(harness.service.joinWaitingRoom('socket-x', {
            accessCode: 'MISSING',
            player: makeLobbyPlayer({ id: 'player-x' }),
        })).toBe(false);

        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const room = harness.service['rooms'].get(accessCode);
        if (!room) throw new Error('missing room');
        room.isLocked = true;

        expect(harness.service.joinWaitingRoom('socket-y', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-y', avatarId: 1 }),
        })).toBe(false);

        room.isLocked = false;
        expect(harness.service.joinWaitingRoom('socket-z', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-z', avatarId: 0 }),
        })).toBe(false);

        const expectedJoinErrors = 3;
        expect(onError).toHaveBeenCalledTimes(expectedJoinErrors);
    });

    it('joins a room, resolves duplicate names, and updates lock state', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        const joined = harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Alice', avatarId: 1 }),
        });

        const state = harness.service.getWaitingRoomState(accessCode);
        expect(joined).toBe(true);
        expect(state?.players.map((player) => player.name)).toEqual(['Alice', 'Alice-2']);
        expect(state?.isLocked).toBe(true);
    });

    it('adds and removes a virtual player from the organizer waiting room', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        harness.service.addVirtualPlayer('socket-org', { accessCode, profile: 'aggressive' });

        const addedVirtualPlayer = harness.service.getWaitingRoomState(accessCode)?.players.find((player) => player.controller === 'virtual');
        expect(addedVirtualPlayer).toEqual(expect.objectContaining({
            controller: 'virtual',
            isOrganizer: false,
            virtualProfile: 'aggressive',
        }));

        harness.service.kickPlayer('socket-org', { accessCode, playerId: addedVirtualPlayer?.id ?? 'missing' });
        expect(harness.service.getWaitingRoomState(accessCode)?.players).toEqual([
            expect.objectContaining({ id: 'player-1', controller: 'human' }),
        ]);
    });

    it('rejects virtual player additions once the room is starting', async () => {
        const onError = jest.fn();
        harness.service.on(SocketEvents.WaitingRoomError, onError);
        harness.mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const room = harness.service['rooms'].get(accessCode);
        if (!room) throw new Error('missing room');
        room.isStarting = true;
        room.isLocked = true;

        harness.service.addVirtualPlayer('socket-org', { accessCode, profile: 'defensive' });

        expect(harness.service.getWaitingRoomState(accessCode)?.players).toHaveLength(1);
        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-org',
            payload: { message: 'La salle est verrouillee ou complete.' },
        });
    });

    it('moves a joining socket out of its previous room before entering another one', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const firstAccessCode = await harness.service.createWaitingRoom('socket-org-1', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const secondAccessCode = await harness.service.createWaitingRoom('socket-org-2', {
            mapId: 'map-1',
            player: makeLobbyPlayer({ id: 'player-9', name: 'Zoe', avatarId: 9 }),
        });

        expect(harness.service.joinWaitingRoom('socket-player', {
            accessCode: firstAccessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        })).toBe(true);
        expect(harness.service.joinWaitingRoom('socket-player', {
            accessCode: secondAccessCode,
            player: makeLobbyPlayer({ id: 'player-3', name: 'Cara', avatarId: 2 }),
        })).toBe(true);

        expect(harness.service.getWaitingRoomState(firstAccessCode)?.players).toEqual([
            expect.objectContaining({ id: 'player-1' }),
        ]);
        expect(harness.service.getWaitingRoomState(secondAccessCode)?.players).toEqual([
            expect.objectContaining({ id: 'player-9' }),
            expect.objectContaining({ id: 'player-3' }),
        ]);
        expect(harness.service.getAccessCodeForSocket('socket-player')).toBe(secondAccessCode);
    });

    it('adds chat messages, trims content, and ignores blanks', async () => {
        const onMessage = jest.fn();
        const onError = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomMessageSent, onMessage);
        harness.service.on(WaitingRoomEvents.WaitingRoomError, onError);
        harness.mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        harness.service.addMessage('socket-org', { accessCode, content: '   hello world   ' });
        harness.service.addMessage('socket-org', { accessCode, content: '   ' });
        harness.service.addMessage('socket-missing', { accessCode, content: 'hello' });

        expect(onMessage).toHaveBeenCalledWith({
            accessCode,
            payload: expect.objectContaining({
                author: 'Alice',
                content: 'hello world',
            }),
        });
        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-missing',
            payload: { message: 'Auteur introuvable pour ce message.' },
        });
    });

    it('cancels the room when the organizer leaves', async () => {
        const onCancelled = jest.fn();
        const onDirectory = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomCancelled, onCancelled);
        harness.service.on(WaitingRoomEvents.WaitingRoomDirectoryUpdated, onDirectory);
        harness.mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        harness.service.leaveWaitingRoom('socket-org', accessCode);

        expect(harness.service['rooms'].has(accessCode)).toBe(false);
        expect(onCancelled).toHaveBeenCalledWith({ accessCode });
        expect(onDirectory).toHaveBeenCalled();
    });

    it('removes a non-organizer from the room and keeps it joinable', async () => {
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        harness.service.leaveWaitingRoom('socket-2', accessCode);

        expect(harness.service.getWaitingRoomState(accessCode)).toEqual(expect.objectContaining({
            players: [expect.objectContaining({ id: 'player-1' })],
            isLocked: false,
        }));
    });

    it('only lets the organizer kick players and never allows kicking the organizer', async () => {
        const onError = jest.fn();
        const onKicked = jest.fn();
        harness.service.on(WaitingRoomEvents.WaitingRoomError, onError);
        harness.service.on(WaitingRoomEvents.WaitingRoomPlayerKicked, onKicked);
        harness.mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const accessCode = await harness.service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        harness.service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        harness.service.kickPlayer('socket-2', { accessCode, playerId: 'player-1' });
        harness.service.kickPlayer('socket-org', { accessCode, playerId: 'player-1' });
        harness.service.kickPlayer('socket-org', { accessCode, playerId: 'player-2' });

        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-2',
            payload: { message: 'Seul l organisateur peut exclure des joueurs.' },
        });
        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-org',
            payload: { message: 'L organisateur ne peut pas etre exclu.' },
        });
        expect(onKicked).toHaveBeenCalledWith({
            accessCode,
            kickedSocketId: 'socket-2',
        });
        expect(harness.service.getWaitingRoomState(accessCode)?.players).toHaveLength(1);
    });
});
