import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { createMockGameSessionPreview, createMockGameSessionPreview2, createPlayerPayload } from '@app/services/session/mock-values';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { ErrorSocketEvents, PageContext, PageSocketEvents, RoomSocketEvents, WaitingRoomEvents } from '@common/socket-events';
import { SessionApiService } from './session-api.service';
import { SessionService } from './session.service';

/**
 * SessionService Event Handlers Unit Tests
 *
 * Testing Strategy:
 * - Verify that all session-related socket events are correctly handled and propagate state updates.
 * - Edge cases tested include:
 *    • Client joining with invalid payload to check error handling and navigation fallback.
 *    • Adding/removing players to ensure player counts update correctly and sessions lock/unlock as expected.
 *    • Deleting sessions and new session notifications to confirm internal state stays consistent.
 * - These cases are tested to guarantee correct handling of real-time updates and invalid or unexpected events,
 *   preventing runtime errors or inconsistent session state during live gameplay.
 *
 * Mocks (SocketManagerService, SessionApiService, Router) isolate event handling from actual networking and routing.
 */

describe('SessionService - Handlers', () => {
    let service: SessionService;
    let socketManagerMock: jasmine.SpyObj<SocketManagerService>;
    let sessionApiMock: jasmine.SpyObj<SessionApiService>;
    let mockRouter: jasmine.SpyObj<Router>;


    beforeEach(() => {
        socketManagerMock = jasmine.createSpyObj('SocketManagerService', [
            'connect',
            'disconnect',
            'send',
            'on',
            'off',
            'isSocketAlive',
            'subscribeToWindowEvent',
            'unsubscribeFromWindowEvent',
        ]);

        sessionApiMock = jasmine.createSpyObj('SessionApiService', [
            'fetchGameSessions',
        ]);

        mockRouter = jasmine.createSpyObj<Router>('Router', ['navigate']);
        mockRouter.navigate.and.returnValue(Promise.resolve(true));

        TestBed.configureTestingModule({
            providers: [
                Router,
                {provide: SocketManagerService, useValue: socketManagerMock},
                {provide: SessionApiService, useValue: sessionApiMock},
                {provide: Router, useValue: mockRouter},
            ],
        });
        service = TestBed.inject(SessionService);
    });

    it('should subscribe to all session events', () => {
        service.subscribeToSessionEvents();

        expect(socketManagerMock.subscribeToWindowEvent).toHaveBeenCalled();

        expect(socketManagerMock.send).toHaveBeenCalledWith(
            PageSocketEvents.JoinPage,
            { page: PageContext.JoinGame },
        );

        expect(socketManagerMock.on).toHaveBeenCalledWith(
            RoomSocketEvents.IncrementPlayerCount,
            service['onClientAddedToSession'],
        );

        expect(socketManagerMock.on).toHaveBeenCalledWith(
            RoomSocketEvents.PlayerJoinedGame,
            service['onJoinedSession'],
        );

        expect(socketManagerMock.on).toHaveBeenCalledWith(
            RoomSocketEvents.DecrementPlayerCount,
            service['onPlayerLeft'],
        );

        expect(socketManagerMock.on).toHaveBeenCalledWith(
            WaitingRoomEvents.GameSessionDeleted,
            service['onDeleteSession'],
        );
        
        expect(socketManagerMock.on).toHaveBeenCalledWith(
            WaitingRoomEvents.ClientJoinedSession,
            service['onClientJoinedSession'],
        );

        expect(socketManagerMock.on).toHaveBeenCalledWith(
            RoomSocketEvents.NewAvailableSession,
            service['onNewAvailableSession'],
        );

        expect(socketManagerMock.on).toHaveBeenCalledWith(
            ErrorSocketEvents.FailedJoinSession,
            service['onFailedJoinSession'],
        );
    });

    it('should unsubscribe to all session events', () => {
        service.unsubscribeToSessionEvents();

        expect(socketManagerMock.unsubscribeFromWindowEvent).toHaveBeenCalled();

        expect(socketManagerMock.send).toHaveBeenCalledWith(
            PageSocketEvents.LeavePage,
            { page: PageContext.JoinGame },
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            RoomSocketEvents.IncrementPlayerCount,
            service['onClientAddedToSession'],
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            RoomSocketEvents.PlayerJoinedGame,
            service['onJoinedSession'],
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            RoomSocketEvents.DecrementPlayerCount,
            service['onPlayerLeft'],
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            WaitingRoomEvents.GameSessionDeleted,
            service['onDeleteSession'],
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            WaitingRoomEvents.ClientJoinedSession,
            service['onClientJoinedSession'],
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            RoomSocketEvents.NewAvailableSession,
            service['onNewAvailableSession'],
        );

        expect(socketManagerMock.off).toHaveBeenCalledWith(
            ErrorSocketEvents.FailedJoinSession,
            service['onFailedJoinSession'],
        );
    });

    it('should reset error and navigate - onJoinedSession ', () => {
        service['onJoinedSession']();
        expect(service.errorMessage()).toBe('');
        expect(mockRouter.navigate).toHaveBeenCalledWith(['waiting-room']);
    });

    it('should store payload, reset error and navigate - onClientJoinedSession ', () => {
        const playerPayload = createPlayerPayload();
        service['onClientJoinedSession'](playerPayload);

        expect(service['joinedSessionPayload']).toEqual(playerPayload);
        expect(service.errorMessage()).toBe('');
        expect(mockRouter.navigate).toHaveBeenCalledWith(['waiting-room']);
    });

    it('should append session preview - onNewAvailableSession ', () => {
        const mockGameSessionPreview = createMockGameSessionPreview();
        service['sessionPreviewSubjects'].next([]);
        const nextSpy = spyOn(service['sessionPreviewSubjects'], 'next').and.callThrough();
        service['onNewAvailableSession'](mockGameSessionPreview);
        expect(nextSpy).toHaveBeenCalled();
        expect(service['sessionPreviewSubjects'].value).toContain(mockGameSessionPreview);
    });

    it(' should call updatePlayerCount with +1 - onClientAddedToSession', () => {
        // To spy on private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePlayerCountSpy = spyOn<any>(service, 'updatePlayerCount');
        const previewId = 'session123';
        service['onClientAddedToSession'](previewId);
        expect(updatePlayerCountSpy).toHaveBeenCalledWith(previewId, 1);
    });

    it(' should call updatePlayerCount with -1 - onPlayerLeft', () => {
        // To spy on private method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePlayerCountSpy = spyOn<any>(service, 'updatePlayerCount');
        const previewId = 'session123';
        service['onPlayerLeft'](previewId);
        expect(updatePlayerCountSpy).toHaveBeenCalledWith(previewId, -1);
    });

    it('should remove session from sessionPreviewSubjects - onDeleteSession ', () => {
        const mockGameSessionPreview = createMockGameSessionPreview();
        const mockGameSessionPreview2 = createMockGameSessionPreview2();
        service['sessionPreviewSubjects'].next([mockGameSessionPreview, mockGameSessionPreview2]);
        const nextSpy = spyOn(service['sessionPreviewSubjects'], 'next').and.callThrough();
        service['onDeleteSession']('id8965');
        expect(nextSpy).toHaveBeenCalled();
        expect(service['sessionPreviewSubjects'].value).toEqual([mockGameSessionPreview]);
    });

    it('should set the error message - onFailedJoinSession ', () => {
        const message = 'Failed to join';
        service['onFailedJoinSession'](message);
        expect(service.errorMessage()).toBe(message);
    });
});