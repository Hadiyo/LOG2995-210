import { TestBed } from '@angular/core/testing';
import { MapApiService } from '@app/services/map/map-api.service';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { GameMode, MapSize } from '@common/maps/map.enums';
import type { EditorMap, MapSummary } from '@common/maps/map.interface';
import { MapSocketEvents, PageContext, PageSocketEvents } from '@common/socket-events';
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

    const makeMap1 = (overrides: Partial<MapSummary> = {}): MapSummary => ({
        id: '1',
        name: 'Map1',
        description: 'Desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: SAMPLE_DATE_ISO,
        visibility: true,
        ...overrides,
    });

    const makeMap2 = (overrides: Partial<MapSummary> = {}): MapSummary => ({
        id: '2',
        name: 'Map2',
        description: 'Desc',
        mode: GameMode.CLASSIC,
        size: MapSize.M,
        date: SAMPLE_DATE_ISO,
        visibility: false,
        ...overrides,
    });

    const makeEditorMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
        id: '',
        name: 'NewMap',
        description: 'Desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: SAMPLE_DATE_ISO,
        map: [],
        objects: [],
        visibility: true,
        ...overrides,
    });

    const mockMaps = [makeMap1(), makeMap2()];

    beforeEach(() => {
        mapApiMock = jasmine.createSpyObj('MapApiService', [
            'getAllMapsSummary',
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

        mapApiMock.getAllMapsSummary.and.returnValue(of(mockMaps));

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
        mapApiMock.getAllMapsSummary.and.returnValue(throwError(() => new Error()));
        service.loadMaps();
        expect(service.state()).toBe(ServiceState.Error);
    });

    it('should call saveMap on createMap', async () => {
        const newMap = makeEditorMap();
        mapApiMock.saveMap.and.returnValue(of(newMap));
        await service.createMap(newMap);
        expect(mapApiMock.saveMap).toHaveBeenCalledWith(newMap);
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
        const spy = spyOn(service, 'loadMaps').and.stub();
        service.subscribeToMapEvents();
        expect(socketMock.send).toHaveBeenCalledWith(
            PageSocketEvents.JoinPage,
            { page: PageContext.MapManagement },
        );
        expect(socketMock.on).toHaveBeenCalledWith(MapSocketEvents.MapCreated, jasmine.any(Function));
        expect(socketMock.on).toHaveBeenCalledWith(MapSocketEvents.MapUpdated, jasmine.any(Function));
        expect(socketMock.on).toHaveBeenCalledWith(MapSocketEvents.MapDeleted, jasmine.any(Function));
        expect(socketMock.on).toHaveBeenCalledWith(MapSocketEvents.ToggleMapVisibility, jasmine.any(Function));
        expect(spy).toHaveBeenCalled();
    });

    it('should unsubscribe from socket events', () => {
        service.unsubscribeFromMapEvents();
        expect(socketMock.send).toHaveBeenCalledWith(
            PageSocketEvents.LeavePage,
            { page: PageContext.MapManagement },
        );
        expect(socketMock.off).toHaveBeenCalledWith(MapSocketEvents.MapCreated, jasmine.any(Function));
        expect(socketMock.off).toHaveBeenCalledWith(MapSocketEvents.MapUpdated, jasmine.any(Function));
        expect(socketMock.off).toHaveBeenCalledWith(MapSocketEvents.MapDeleted, jasmine.any(Function));
        expect(socketMock.off).toHaveBeenCalledWith(MapSocketEvents.ToggleMapVisibility, jasmine.any(Function));
    });

    it('should add map when socket map created fires', (done) => {
        service['onMapCreated']({ id: '3', name: 'map3', visibility: true } as MapSummary);

        service.maps$.subscribe(maps => {
            expect(maps.find(m => m.id === '3')).toBeTruthy();
            done();
        });
    });

    it('should update map when socket map updated fires', (done) => {
        service['onMapUpdated']({ id: '1', name: 'updated', visibility: true } as MapSummary);

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

    it('should subscribe to window lifecycle events on init', () => {
        expect(socketMock.subscribeToWindowEvent).toHaveBeenCalled();
    });

    it('should set error state if updateVisibility fails', () => {
        mapApiMock.updateMapVisibility.and.returnValue(throwError(() => new Error()));
        service.toggleMapVisibility(mockMaps[0]);
        expect(service.state()).toBe(ServiceState.Error);
    });
});
