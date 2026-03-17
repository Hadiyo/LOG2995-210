import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { Subscription } from 'rxjs';
import { SessionApiService } from './session-api.service';
import { SessionService } from './session.service';


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
        service.setMapId('newMapId');
        expect(service['currentMapId']).toBe('newMapId');
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

    it('should consume the sessionPayload', () => {
        service['joinedSessionPayload'] = 
        service.consumeJoinedSessionPayload();
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

    it('should initialize the sessionService if the socket is alive - initGameSessionService', () => {
        socketManagerMock.isSocketAlive.and.returnValue(true);
        const spyLoad = spyOn(service, 'loadGameSessions').and.stub();
        const spySessionEvents = spyOn(service, 'subscribeToSessionEvents').and.stub();

        service.initGameSessionService();

        expect(socketManagerMock.connect).not.toHaveBeenCalled();
        expect(spyLoad).toHaveBeenCalled();
        expect(spySessionEvents).toHaveBeenCalled();
    });

    it('should clear all current ids - clearCurrentIds', () => {
        service['clearCurrentIds']();
        expect(service['currentMapId']).toBe(undefined);
        expect(service['currentPreviewId']).toBe(undefined);
    });
});