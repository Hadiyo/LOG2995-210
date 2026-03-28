import { ChatService } from '@app/services/chat/chat.service';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { PreviewImageFormat } from '@common/enum';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { EditorMap, MapSummary } from '@common/maps/map.interface';

export const makeLobbyPlayer = (overrides: Partial<MatchLobbyPlayer> = {}): MatchLobbyPlayer => ({
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

export const makeMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
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

export const makeMapSummary = (overrides: Partial<MapSummary> = {}): MapSummary => ({
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

export function createWaitingRoomServiceHarness() {
    let service: WaitingRoomService;
    let mapService: { getMapById: jest.Mock; getAllMapsSummary: jest.Mock };
    let gameSessionService: { createSessionFromWaitingRoom: jest.Mock; destroySession: jest.Mock };
    let chatService: { createMessage: jest.MockedFunction<ChatService['createMessage']> };

    beforeEach(() => {
        mapService = {
            getMapById: jest.fn(),
            getAllMapsSummary: jest.fn(),
        };
        gameSessionService = {
            createSessionFromWaitingRoom: jest.fn(),
            destroySession: jest.fn(),
        };
        chatService = {
            createMessage: jest.fn((author: string, content: string, maxContentLength?: number) => {
                const normalizedContent = typeof maxContentLength === 'number'
                    ? content.trim().slice(0, maxContentLength)
                    : content.trim();

                if (!normalizedContent) {
                    return null;
                }

                return {
                    id: 'message-1',
                    author,
                    content: normalizedContent,
                    createdAt: '2026-01-01T00:00:00.000Z',
                };
            }),
        };

        service = new WaitingRoomService(mapService as never, gameSessionService as never, chatService as never);
    });

    return {
        get service() {
            return service;
        },
        get mapService() {
            return mapService;
        },
        get gameSessionService() {
            return gameSessionService;
        },
        get chatService() {
            return chatService;
        },
    };
}
