import { inject, Injectable, signal } from '@angular/core';
import { MapApiService } from '@app/services/map/map-api.service';
import { ServiceState } from '@app/services/service-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import type { EditorMap, MapSummary } from '@common/maps/map.interface';
import { MapSocketEvents, MapVisibilityEventPayload, PageContext, PageSocketEvents } from '@common/socket-events';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';

/** Single source of truth for the available collection of maps
 *  Needed to ensure AdminPage and GameCreation Page visualize the same
 *  maps through the socket interface.
 */

@Injectable({ providedIn: 'root' })
export class MapStateService {
    constructor(private socket: SocketManagerService) {
        this.socket.connect();
        this.socket.subscribeToWindowEvent();
        this.loadMaps();
    }

    private mapsSubject = new BehaviorSubject<MapSummary[]>([]);
    maps$ = this.mapsSubject.asObservable();

    readonly state = signal<ServiceState>(ServiceState.Idle);
    private readonly mapApiService = inject(MapApiService);

    /** MAPS API METHODS */
    loadMaps(): void {
        this.state.set(ServiceState.Loading);
        this.mapApiService.getAllMapsSummary().subscribe({
            next: maps => {
                this.mapsSubject.next(maps);
                this.state.set(ServiceState.Loaded);
            },
            error: () => this.state.set(ServiceState.Error),
        });
    }

    async createMap(map: EditorMap): Promise<void> {
        await firstValueFrom(this.mapApiService.saveMap(map));
    }

    deleteMap(map: MapSummary): Observable<void> {
        return this.mapApiService.deleteMap(map.id);
    }

    toggleMapVisibility(map: MapSummary): void {
        this.mapApiService.updateMapVisibility(map.id, !map.visibility).subscribe({
            error: () => this.state.set(ServiceState.Error),
        });
    }


    /** SOCKET SERVICE FOR MAP */
    subscribeToMapEvents(): void {
        this.socket.send(PageSocketEvents.JoinPage, { page: PageContext.MapManagement });
        this.socket.on<MapSummary>(MapSocketEvents.MapCreated, this.onMapCreated);
        this.socket.on<MapSummary>(MapSocketEvents.MapUpdated, this.onMapUpdated);
        this.socket.on<string>(MapSocketEvents.MapDeleted, this.onMapDeleted);
        this.socket.on<MapVisibilityEventPayload>(MapSocketEvents.ToggleMapVisibility, this.onToggleVisibility);
        this.loadMaps();
    }

    unsubscribeFromMapEvents(): void {
        this.socket.send(PageSocketEvents.LeavePage, { page: PageContext.MapManagement });
        this.socket.off(MapSocketEvents.MapCreated, this.onMapCreated);
        this.socket.off(MapSocketEvents.MapUpdated, this.onMapUpdated);
        this.socket.off(MapSocketEvents.MapDeleted, this.onMapDeleted);
        this.socket.off(MapSocketEvents.ToggleMapVisibility, this.onToggleVisibility);
    }

    private onMapCreated = (map: MapSummary): void => {
        this.mapsSubject.next([...this.mapsSubject.value, map]);
    };

    private onMapUpdated = (updatedMap: MapSummary): void => {
        this.mapsSubject.next(this.mapsSubject.value.map(map => map.id === updatedMap.id ? { ...updatedMap } : map));
    };

    private onMapDeleted = (mapId: string): void => {
        this.deleteSubjectMap(mapId);
    };

    private onToggleVisibility = (payload: MapVisibilityEventPayload): void => {
        this.setVisibility(payload.id, payload.isVisible);
    };

    /** UTILITY METHODS */
    private deleteSubjectMap(id: string): void {
        this.mapsSubject.next(this.mapsSubject.value.filter(currentMap => currentMap.id !== id));
    }

    private setVisibility(id: string, newVisibility: boolean): void {
        this.mapsSubject.next(this.mapsSubject.value.map((item) =>
            (item.id === id ? { ...item, visibility: newVisibility } : item)));
    }
}
