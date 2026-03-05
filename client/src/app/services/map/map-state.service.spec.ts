import { TestBed } from '@angular/core/testing';
import { MapApiService } from '@app/services/map/map-api.service';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { EditorMap } from '@common/maps/map.interface';
import { RoomSocketEvents } from '@common/socket-events';
import { of, throwError } from 'rxjs';
import { MapStateService } from './map-state.service';

/**
 * Testing Strategy:
 * We validate normal state-management behavior first by ensuring maps load correctly,
 * state transitions are updated, and API actions (create/delete/toggle visibility)
 * delegate to MapApiService as expected.
 *
 * We then test event-driven updates from sockets (map created/updated/deleted/visibility changed)
 * and lifecycle wiring (join/leave room, event subscriptions, and beforeunload disconnect).
 *
 * We also cover failure paths (load/toggle errors) to confirm the service enters
 * an error state and remains predictable under backend or network issues.
 */
describe('MapStateService', () => {
    let service: MapStateService;
    let mapApiMock: jasmine.SpyObj<MapApiService>;
    let socketMock: jasmine.SpyObj<SocketManagerService>;

    const SAMPLE_DATE_ISO = '2026-02-08T12:00:00.000Z';

    const makeMap1 = (overrides: Partial<EditorMap> = {}): EditorMap => ({
        id: '',
        name: 'Map2',
        description: 'Desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: SAMPLE_DATE_ISO,
        map: [],
        objects: [],
        visibility: true,
        ...overrides,
    });

    const makeMap2 = (overrides: Partial<EditorMap> = {}): EditorMap => ({
        id: '',
        name: 'Map2',
        description: 'Desc',
        mode: GameMode.CTF,
        size: MapSize.M,
        date: SAMPLE_DATE_ISO,
        map: [],
        objects: [],
        visibility: false,
        ...overrides,
    });

    const mockMaps = [makeMap1({ id: '1' }), makeMap2({ id: '2' })];

    beforeEach(() => {
        mapApiMock = jasmine.createSpyObj('MapApiService', [
            'getAllMaps',
            'saveMap',
            'deleteMap',
            'updateMapVisibility',
        ]);

        socketMock = jasmine.createSpyObj('SocketManagerService', [
            'connect',
            'disconnect',
            'send',
            'on',
            'off',
            'subscribeToWindowEvent',
        ]);

        mapApiMock.getAllMaps.and.returnValue(of(mockMaps));

        TestBed.configureTestingModule({
            providers: [
                MapStateService,
                { provide: MapApiService, useValue: mapApiMock },
                { provide: SocketManagerService, useValue: socketMock },
            ],
        });

        service = TestBed.inject(MapStateService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should load maps on init', (done) => {
        service.maps$.subscribe(maps => {
            expect(maps.length).toBe(2);
            expect(service.state()).toBe(ServiceState.Loaded);
            done();
        });
    });

    it('should set error state if loadMaps fails', () => {
        mapApiMock.getAllMaps.and.returnValue(throwError(() => new Error()));
        service.loadMaps();
        expect(service.state()).toBe(ServiceState.Error);
    });

    it('should call saveMap on createMap', async () => {
        mapApiMock.saveMap.and.returnValue(of(mockMaps[0]));
        await service.createMap(mockMaps[0]);
        expect(mapApiMock.saveMap).toHaveBeenCalledWith(mockMaps[0]);
    });

    it('should call deleteMap api', () => {
        mapApiMock.deleteMap.and.returnValue(of());
        service.deleteMap(mockMaps[0]);
        expect(mapApiMock.deleteMap).toHaveBeenCalledWith('1');
    });

    it('should toggle visibility api', () => {
        mapApiMock.updateMapVisibility.and.returnValue(of());
        service.toggleMapVisibility(mockMaps[1]);
        expect(mapApiMock.updateMapVisibility).toHaveBeenCalledWith('2', true);
    });

    it('should subscribe to socket events', () => {
        const spy = spyOn(service, 'loadMaps');
        service.subscribeToMapEvents();
        expect(socketMock.send).toHaveBeenCalledWith(
            RoomSocketEvents.JoinSessionRoom,
        );
        expect(socketMock.on).toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
    });

    it('should unsubscribe from socket events', () => {
        const NB_OFF_CALLS = 4;
        service.unsubscribeFromMapEvents();
        expect(socketMock.send).toHaveBeenCalled();
        expect(socketMock.off).toHaveBeenCalledTimes(NB_OFF_CALLS);
    });

    it('should add map when socket map created fires', (done) => {
        service['onMapCreated']({ id: '3', name: 'map3', visibility: true } as EditorMap);

        service.maps$.subscribe(maps => {
            expect(maps.find(m => m.id === '3')).toBeTruthy();
            done();
        });
    });

    it('should update map when socket map updated fires', (done) => {
        service['onMapUpdated']({ id: '1', name: 'updated', visibility: true } as EditorMap);

        service.maps$.subscribe(maps => {
            const map = maps.find(m => m.id === '1');
            expect(map?.name).toBe('updated');
            done();
        });
    });

    it('should delete map when socket map deleted fires', (done) => {
        service['onMapDeleted']('1');

        service.maps$.subscribe(maps => {
            expect(maps.find(m => m.id === '1')).toBeUndefined();
            done();
        });
    });

    it('should toggle visibility from socket event', (done) => {
        service['onToggleVisibility']({ id: '2', isVisible: true });

        service.maps$.subscribe(maps => {
            expect(maps.find(m => m.id === '2')?.visibility).toBeTrue();
            done();
        });
    });

    it('should set error state if updateVisibility fails', () => {
        mapApiMock.updateMapVisibility.and.returnValue(throwError(() => new Error()));
        service.toggleMapVisibility(mockMaps[0]);
        expect(service.state()).toBe(ServiceState.Error);
    });
});
