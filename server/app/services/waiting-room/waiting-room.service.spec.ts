/* eslint-disable max-lines */
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { ACCESS_CODE_LENGTH, MIN_PLAYERS_TO_START } from '@app/services/waiting-room/waiting-room.constants';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { PreviewImageFormat } from '@common/enum';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { EditorMap, MapSummary } from '@common/maps/map.interface';
import { SocketEvents } from '@common/socket-events';

const makeLobbyPlayer = (overrides: Partial<MatchLobbyPlayer> = {}): MatchLobbyPlayer => ({
    id: 'player-1',
    name: 'Alice',
    avatarId: 0,
    isOrganizer: false,
    speed: 4,
    maxHealth: 6,
    baseAttack: 4,
    baseDefense: 4,
    attackDie: 'D4',
    defenseDie: 'D6',
    controller: 'human',
    ...overrides,
});

const makeMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
    id: 'map-1',
    name: 'Arena',
    description: 'desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: '2026-01-01T00:00:00.000Z',
    map: [],
    objects: [],
    visibility: true,
    ...overrides,
});

const makeMapSummary = (overrides: Partial<MapSummary> = {}): MapSummary => ({
    id: 'map-1',
    name: 'Arena',
    description: 'desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: '2026-01-01T00:00:00.000Z',
    visibility: true,
    previewImage: 'img',
    previewImageFormat: PreviewImageFormat.PNG,
    ...overrides,
});

describe('WaitingRoomService', () => {
    let service: WaitingRoomService;
    let mapService: { getMapById: jest.Mock; getAllMapsSummary: jest.Mock };
    let gameSessionService: { createSessionFromWaitingRoom: jest.Mock; destroySession: jest.Mock };

    beforeEach(() => {
        mapService = {
            getMapById: jest.fn(),
            getAllMapsSummary: jest.fn(),
        };
        gameSessionService = {
            createSessionFromWaitingRoom: jest.fn(),
            destroySession: jest.fn(),
        };

        service = new WaitingRoomService(mapService as never, gameSessionService as never);
    });

    it('creates a waiting room, marks the organizer, and emits updates', async () => {
        const onUpdated = jest.fn();
        const onDirectory = jest.fn();
        service.on(SocketEvents.WaitingRoomUpdated, onUpdated);
        service.on(SocketEvents.WaitingRoomDirectoryUpdated, onDirectory);
        mapService.getMapById.mockResolvedValue(makeMap());

        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        const room = service['rooms'].get(accessCode);
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
        mapService.getMapById.mockResolvedValue(makeMap());

        const firstAccessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const secondAccessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        expect(service.getWaitingRoomState(firstAccessCode)).toBeNull();
        expect(service.getAccessCodeForSocket('socket-org')).toBe(secondAccessCode);
    });

    it('returns only joinable waiting room previews', async () => {
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const openCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        service['rooms'].set('LOCKED1', {
            accessCode: 'LOCKED1',
            mapId: 'map-2',
            organizerSocketId: 'socket-2',
            players: [makeLobbyPlayer({ id: 'player-2' })],
            messages: [],
            socketToPlayerId: new Map([['socket-2', 'player-2']]),
            isLocked: true,
            isStarting: false,
            maxPlayers: 4,
        });
        mapService.getAllMapsSummary.mockResolvedValue([
            makeMapSummary({ id: 'map-1', size: MapSize.M, name: 'Open room' }),
            makeMapSummary({ id: 'map-2', name: 'Locked room' }),
        ]);

        const previews = await service.getAvailableWaitingRoomPreviews();

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
        service.on(SocketEvents.WaitingRoomError, onError);
        mapService.getMapById.mockResolvedValue(makeMap());

        expect(service.joinWaitingRoom('socket-x', {
            accessCode: 'MISSING',
            player: makeLobbyPlayer({ id: 'player-x' }),
        })).toBe(false);

        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const room = service['rooms'].get(accessCode);
        if (!room) throw new Error('missing room');
        room.isLocked = true;

        expect(service.joinWaitingRoom('socket-y', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-y', avatarId: 1 }),
        })).toBe(false);

        room.isLocked = false;
        expect(service.joinWaitingRoom('socket-z', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-z', avatarId: 0 }),
        })).toBe(false);

        const expectedJoinErrors = 3;
        expect(onError).toHaveBeenCalledTimes(expectedJoinErrors);
    });

    it('joins a room, resolves duplicate names, and updates lock state', async () => {
        mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        const joined = service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Alice', avatarId: 1 }),
        });

        const state = service.getWaitingRoomState(accessCode);
        expect(joined).toBe(true);
        expect(state?.players.map((player) => player.name)).toEqual(['Alice', 'Alice-2']);
        expect(state?.isLocked).toBe(true);
    });

    it('moves a joining socket out of its previous room before entering another one', async () => {
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const firstAccessCode = await service.createWaitingRoom('socket-org-1', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        const secondAccessCode = await service.createWaitingRoom('socket-org-2', {
            mapId: 'map-1',
            player: makeLobbyPlayer({ id: 'player-9', name: 'Zoe', avatarId: 9 }),
        });

        expect(service.joinWaitingRoom('socket-player', {
            accessCode: firstAccessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        })).toBe(true);
        expect(service.joinWaitingRoom('socket-player', {
            accessCode: secondAccessCode,
            player: makeLobbyPlayer({ id: 'player-3', name: 'Cara', avatarId: 2 }),
        })).toBe(true);

        expect(service.getWaitingRoomState(firstAccessCode)?.players).toEqual([
            expect.objectContaining({ id: 'player-1' }),
        ]);
        expect(service.getWaitingRoomState(secondAccessCode)?.players).toEqual([
            expect.objectContaining({ id: 'player-9' }),
            expect.objectContaining({ id: 'player-3' }),
        ]);
        expect(service.getAccessCodeForSocket('socket-player')).toBe(secondAccessCode);
    });

    it('adds chat messages, trims content, and ignores blanks', async () => {
        const onMessage = jest.fn();
        const onError = jest.fn();
        service.on(SocketEvents.WaitingRoomMessageSent, onMessage);
        service.on(SocketEvents.WaitingRoomError, onError);
        mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        service.addMessage('socket-org', { accessCode, content: '   hello world   ' });
        service.addMessage('socket-org', { accessCode, content: '   ' });
        service.addMessage('socket-missing', { accessCode, content: 'hello' });

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
        service.on(SocketEvents.WaitingRoomCancelled, onCancelled);
        service.on(SocketEvents.WaitingRoomDirectoryUpdated, onDirectory);
        mapService.getMapById.mockResolvedValue(makeMap());
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        service.leaveWaitingRoom('socket-org', accessCode);

        expect(service['rooms'].has(accessCode)).toBe(false);
        expect(onCancelled).toHaveBeenCalledWith({ accessCode });
        expect(onDirectory).toHaveBeenCalled();
    });

    it('removes a non-organizer from the room and keeps it joinable', async () => {
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        service.leaveWaitingRoom('socket-2', accessCode);

        expect(service.getWaitingRoomState(accessCode)).toEqual(expect.objectContaining({
            players: [expect.objectContaining({ id: 'player-1' })],
            isLocked: false,
        }));
    });

    it('only lets the organizer kick players and never allows kicking the organizer', async () => {
        const onError = jest.fn();
        const onKicked = jest.fn();
        service.on(SocketEvents.WaitingRoomError, onError);
        service.on(SocketEvents.WaitingRoomPlayerKicked, onKicked);
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        service.kickPlayer('socket-2', { accessCode, playerId: 'player-1' });
        service.kickPlayer('socket-org', { accessCode, playerId: 'player-1' });
        service.kickPlayer('socket-org', { accessCode, playerId: 'player-2' });

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
        expect(service.getWaitingRoomState(accessCode)?.players).toHaveLength(1);
    });

    it('starts a game only when the organizer and roster are valid', async () => {
        const onError = jest.fn();
        const onStarted = jest.fn();
        const onDirectory = jest.fn();
        service.on(SocketEvents.WaitingRoomError, onError);
        service.on(SocketEvents.WaitingRoomGameStarted, onStarted);
        service.on(SocketEvents.WaitingRoomDirectoryUpdated, onDirectory);
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        gameSessionService.createSessionFromWaitingRoom.mockResolvedValue('session-99');
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });

        await service.startGame('socket-2', accessCode);
        await service.startGame('socket-org', accessCode);

        service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });
        await service.startGame('socket-org', accessCode);

        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-2',
            payload: { message: 'Seul l organisateur peut lancer la partie.' },
        });
        expect(onError).toHaveBeenCalledWith({
            socketId: 'socket-org',
            payload: { message: 'Il faut au moins 2 joueurs pour demarrer.' },
        });
        expect(gameSessionService.createSessionFromWaitingRoom).toHaveBeenCalledWith(
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
        expect(service['rooms'].has(accessCode)).toBe(false);
        expect(onDirectory).toHaveBeenCalled();
    });

    it('starts a waiting room only once even when requested twice quickly', async () => {
        const onStarted = jest.fn();
        service.on(SocketEvents.WaitingRoomGameStarted, onStarted);
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));

        let resolveSessionCreation: ((sessionId: string) => void) | undefined;
        gameSessionService.createSessionFromWaitingRoom.mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolveSessionCreation = resolve;
                }),
        );

        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        const firstStart = service.startGame('socket-org', accessCode);
        const secondStart = service.startGame('socket-org', accessCode);

        expect(gameSessionService.createSessionFromWaitingRoom).toHaveBeenCalledTimes(1);
        expect(service.getWaitingRoomState(accessCode)).toEqual(expect.objectContaining({
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

    it('cancels a started room cleanly if the organizer leaves during session creation', async () => {
        const onCancelled = jest.fn();
        const onStarted = jest.fn();
        service.on(SocketEvents.WaitingRoomCancelled, onCancelled);
        service.on(SocketEvents.WaitingRoomGameStarted, onStarted);
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));

        let resolveSessionCreation: ((sessionId: string) => void) | undefined;
        gameSessionService.createSessionFromWaitingRoom.mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolveSessionCreation = resolve;
                }),
        );

        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });

        const startPromise = service.startGame('socket-org', accessCode);
        service.leaveWaitingRoom('socket-org', accessCode);

        resolveSessionCreation?.('session-99');
        await startPromise;

        expect(onCancelled).toHaveBeenCalledWith({ accessCode });
        expect(onStarted).not.toHaveBeenCalled();
        expect(gameSessionService.destroySession).toHaveBeenCalledWith('session-99');
        expect(service.getWaitingRoomState(accessCode)).toBeNull();
    });

    it('finds the access code for a socket and disconnects through leaveWaitingRoom', async () => {
        mapService.getMapById.mockResolvedValue(makeMap({ size: MapSize.M }));
        const accessCode = await service.createWaitingRoom('socket-org', {
            mapId: 'map-1',
            player: makeLobbyPlayer(),
        });
        service.joinWaitingRoom('socket-2', {
            accessCode,
            player: makeLobbyPlayer({ id: 'player-2', name: 'Bob', avatarId: 1 }),
        });
        const leaveSpy = jest.spyOn(service, 'leaveWaitingRoom');

        expect(service.getAccessCodeForSocket('socket-2')).toBe(accessCode);

        service.handleDisconnect('socket-2');

        expect(leaveSpy).toHaveBeenCalledWith('socket-2', accessCode);
    });
});
