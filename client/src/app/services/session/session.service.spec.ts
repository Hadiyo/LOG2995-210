import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ServiceState } from '@app/services/service-state.enum';
import {
    createMockGameSessionPreview,
    createMockGameSessionPreview2,
    createMockPlayer,
    createPlayerPayload,
} from '@app/services/session/mock-values';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { RoomSocketEvents } from '@common/socket-events';
import { of, Subscription, throwError } from 'rxjs';
import { SessionApiService } from './session-api.service';
import { SessionService } from './session.service';

/**
 * SessionService Unit Tests
 *
 * Testing Strategy:
 * - Verify core state management for sessions: current map/preview IDs, context, and session initialization.
 * - Edge cases tested include:
 *    • Undefined currentMapId or currentPreviewId to ensure getters return undefined correctly.
 *    • Switching context between 'create' and 'join' to confirm proper context updates and error resets.
 *    • Socket alive vs not alive during initialization to validate correct behavior depending on connection state.
 *    • Handling invalid inputs in createGameSession (undefined map or character) to check proper error handling.
 * - These edge cases are important to ensure stability and predictable service behavior in all game session scenarios.
 *
 * Mocks (SocketManagerService, SessionApiService) isolate the service logic from external dependencies.
 */

describe('SessionService', () => {
    let service: SessionService;
    let socketManagerMock: jasmine.SpyObj<SocketManagerService>;
    let sessionApiMock: jasmine.SpyObj<SessionApiService>;
    let subscription!: Subscription;

    beforeEach(() => {
        socketManagerMock = jasmine.createSpyObj('SocketManagerService', [
            'connect',
            'disconnect',
            'send',
            'on',
            'off',
            'isSocketAlive',
            'subscribeToWindowEvent',
        ]);

        sessionApiMock = jasmine.createSpyObj('SessionApiService', [
            'fetchGameSessions',
        ]);

        TestBed.configureTestingModule({
            providers: [
                Router,
                {provide: SocketManagerService, useValue: socketManagerMock},
                {provide: SessionApiService, useValue: sessionApiMock},
            ],
        });
        service = TestBed.inject(SessionService);
    });

    it('should return currentMapId if defined - getMapId', () => {
        service['currentMapId'] = 'id1234';
        const result = service.getMapId();
        expect(result).toBe('id1234');
    });

    it('should return undefined if the currentMapId is undefined - getMapId', () => {
        service['currentMapId'] = undefined;
        const result = service.getMapId();
        expect(result).toBe(undefined);
    });

    it('should return currentPreviewId if defined - getPreviewId', () => {
        service['currentPreviewId'] = 'id1234';
        const result = service.getPreviewId();
        expect(result).toBe('id1234');
    });

    it('should return undefined if the currentPreviewId is undefined - getPreviewId', () => {
        service['currentPreviewId'] = undefined;
        const result = service.getPreviewId();
        expect(result).toBe(undefined);
    });

    it('should set the currentMapId to a new id - setMapId', () => {
        service['currentMapId'] = 'id1234';
        service.setMapId('newMapId');
        expect(service['currentMapId']).toBe('newMapId');
    });

    it('should set the currentPreviewId to a new id - setPreviewId', () => {
        service['currentPreviewId'] = 'id1234';
        service.setPreviewId('newMapId');
        expect(service['currentPreviewId']).toBe('newMapId');
    });

    it('should set the context from null to create - setContext', (done) => {
        service['contextSubject'].next(null);
        service.setContext('create');
        expect(service.errorMessage()).toBe('');
        subscription = service.context$.subscribe(context => {
            expect(context).toBe('create');
        });
        subscription.unsubscribe();
        done();
    });

    it('should set the context from null to join - setContext', (done) => {
        service['contextSubject'].next(null);
        service.setContext('join');
        expect(service.errorMessage()).toBe('');
        subscription = service.context$.subscribe(context => {
            expect(context).toBe('join');
        });
        subscription.unsubscribe();
        done();
    });

    it('should set the context from join to create - setContext', (done) => {
        service['contextSubject'].next('join');
        service.setContext('create');
        expect(service.errorMessage()).toBe('');
        subscription = service.context$.subscribe(context => {
            expect(context).toBe('create');
        });
        subscription.unsubscribe();
        done();
    });

    it('should initialize the sessionService if the socket is not alive - initGameSessionService', () => {
        socketManagerMock.isSocketAlive.and.returnValue(false);
        const spyLoad = spyOn(service, 'loadGameSessions').and.stub();
        const spySessionEvents = spyOn(service, 'subscribeToSessionEvents').and.stub();

        service.initGameSessionService();

        expect(socketManagerMock.connect).toHaveBeenCalled();
        expect(spyLoad).toHaveBeenCalled();
        expect(spySessionEvents).toHaveBeenCalled();
    });

    it('consumeJoinedSessionPayload() should return the stored payload then clear it', () => {
        const playerPayload = createPlayerPayload();
        service['joinedSessionPayload'] = playerPayload;

        const result = service.consumeJoinedSessionPayload();
        expect(result).toEqual(playerPayload);
        expect(service.consumeJoinedSessionPayload()).toBeUndefined();
    });

    it('should initialize the sessionService if the socket is alive - initGameSessionService', () => {
        socketManagerMock.isSocketAlive.and.returnValue(true);
        const spyLoad = spyOn(service, 'loadGameSessions').and.stub();
        const spySessionEvents = spyOn(service, 'subscribeToSessionEvents').and.stub();

        service.initGameSessionService();

        expect(socketManagerMock.connect).not.toHaveBeenCalled();
        expect(spyLoad).toHaveBeenCalled();
        expect(spySessionEvents).toHaveBeenCalled();
    });

    it('should fetch all session previews successfully - loadGameSessions', () => {
        const mockGameSessionPreview = createMockGameSessionPreview();
        const mockGameSessionPreview2 = createMockGameSessionPreview2();
        const sessions = [mockGameSessionPreview, mockGameSessionPreview2];
        sessionApiMock.fetchGameSessions.and.returnValue(of(sessions));
        const nextSpy = spyOn(service['sessionPreviewSubjects'], 'next');
        const stateSpy = spyOn(service['state'], 'set');

        service.loadGameSessions();

        expect(stateSpy).toHaveBeenCalledWith(ServiceState.Loading);
        expect(nextSpy).toHaveBeenCalledWith(sessions);
        expect(stateSpy).toHaveBeenCalledWith(ServiceState.Loaded);
    });

    it('should set the session state to error if failure to fetch session - loadGameSessions', () => {
        sessionApiMock.fetchGameSessions.and.returnValue(
            throwError(() => new Error('API fail')),
        );
        const stateSpy = spyOn(service['state'], 'set');

        service.loadGameSessions();

        expect(stateSpy).toHaveBeenCalledWith(ServiceState.Loading);
        expect(stateSpy).toHaveBeenCalledWith(ServiceState.Error);
    });

    it('should send the create session payload if the values are valid - createGameSession', () => {
        const mockPlayer = createMockPlayer();
        service['currentMapId'] = 'id1234';
        // To test private method
         
        const spyPayload = spyOn<any>(service, 'setJoinSessionPayload').and.returnValue({id: 'id1234', character: mockPlayer});
        service.createGameSession(mockPlayer);
        expect(socketManagerMock.send).toHaveBeenCalled();
        expect(spyPayload).toHaveBeenCalled();
        expect(service.errorMessage()).toBe('');
        expect(socketManagerMock.send).toHaveBeenCalledOnceWith(
            RoomSocketEvents.CreateGameSession, {id: 'id1234', character: mockPlayer});
    });

    it('should return and set error message if the character is undefined - createGameSession', () => {
        service['currentMapId'] = 'id1234';
        // To test private method
         
        const spyPayload = spyOn<any>(service, 'setJoinSessionPayload').and.returnValue({id: 'id1234', character: undefined});
        service.createGameSession(undefined);
        expect(socketManagerMock.send).not.toHaveBeenCalled();
        expect(spyPayload).not.toHaveBeenCalled();
        expect(service.errorMessage()).toBe('MapId ou personnage invalid.');
    });

    it('should return and set error message if the currentMap is undefined - createGameSession', () => {
        const mockPlayer = createMockPlayer();
        // To test private method
         
        const spyPayload = spyOn<any>(service, 'setJoinSessionPayload').and.returnValue({id: undefined, character: mockPlayer});
        service['currentMapId'] = undefined;
        service.createGameSession(mockPlayer);
        expect(socketManagerMock.send).not.toHaveBeenCalled();
        expect(spyPayload).not.toHaveBeenCalled();
        expect(service.errorMessage()).toBe('MapId ou personnage invalid.');
    });

    it('should send the previewId by socket to the server to join the session - joinSession', () => {
        service.joinSession('id1234');
        expect(socketManagerMock.send).toHaveBeenCalledWith(RoomSocketEvents.JoinGameRoom, 'id1234');
    });

    it('should send the previewId by socket to the server to leave the session - leaveSession', () => {
        service['currentPreviewId'] = 'id1234';
        service.leaveSession();
        expect(socketManagerMock.send).toHaveBeenCalledWith(RoomSocketEvents.LeaveSession, 'id1234');
    });

    it('should send the character payload to the server - addPlayerToSession', () => {
        const mockPlayer = createMockPlayer();
        service['currentMapId'] = 'id1234';
        // To test private method
         
        const spyPayload = spyOn<any>(service, 'setJoinSessionPayload').and.returnValue({id: 'id1234', character: mockPlayer});
        service['addPlayerToSession'](mockPlayer);
        expect(socketManagerMock.send).toHaveBeenCalled();
        expect(spyPayload).toHaveBeenCalled();
        expect(service.errorMessage()).toBe('');
        expect(socketManagerMock.send).toHaveBeenCalledOnceWith(
            RoomSocketEvents.AddPlayerToSession, {id: 'id1234', character: mockPlayer});
    });

    it('should clear all current ids - clearCurrentIds', () => {
        service['clearCurrentIds']();
        expect(service['currentMapId']).toBe(undefined);
        expect(service['currentPreviewId']).toBe(undefined);
    });

    it('should create the join session payload - setJoinSessionPayload', () => {
        const mockPlayer = createMockPlayer();
        // To test private method
         
        const spy = spyOn<any>(service, 'clearCurrentIds');
        service['currentPreviewId'] = 'id1234';
        const payload = service['setJoinSessionPayload'](mockPlayer, service['currentPreviewId']);
        expect(payload).toEqual({id: 'id1234', character: mockPlayer});
        expect(spy).toHaveBeenCalled();
        expect(service.errorMessage()).toBe('');
    });

    it('should update the number of players and lock state', () => {
        const mockGameSessionPreview = createMockGameSessionPreview();
        const mockGameSessionPreview2 = createMockGameSessionPreview2();
        const NB_PLAYERS_PRIOR_S1 = 3;
        const NB_PLAYERS_AFTER_S1 = 4;
        const NB_PLAYER_S2 = 1;

        const nextSpy = spyOn(service['sessionPreviewSubjects'], 'next').and.callThrough();

        service['sessionPreviewSubjects'].next([mockGameSessionPreview, mockGameSessionPreview2]);

        // Assert: s1 should have nbOfPlayers increased and not locked
        expect(nextSpy).toHaveBeenCalled();

        const updated = service['sessionPreviewSubjects'].value;
        const updatedS1 = updated.find(s => s.id === 'i1234');
        const updatedS2 = updated.find(s => s.id === 'id8965');

        // Check if first map was updated
        expect(updatedS1?.nbOfPlayers).toBe(NB_PLAYERS_PRIOR_S1);
        expect(updatedS1?.isLocked).toBeFalse();

        // Second preview map should be unchanged
        expect(updatedS2?.nbOfPlayers).toBe(NB_PLAYER_S2);
        expect(updatedS2?.isLocked).toBeFalse();

        // Act: increment by 1 to reach maxPlayers
        service['updatePlayerCount']('i1234', 1);

        const updatedAgain = service['sessionPreviewSubjects'].value;
        const updatedS1Again = updatedAgain.find(session => session.id === 'i1234');

        expect(updatedS1Again?.nbOfPlayers).toBe(NB_PLAYERS_AFTER_S1);
        expect(updatedS1Again?.isLocked).toBeTrue();
    });
});