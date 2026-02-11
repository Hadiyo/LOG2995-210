import { inject, Injectable, signal } from '@angular/core';
import { MapApiService } from '@app/services/map/map-api.service';
import { MapLoadState } from '@app/services/map/map-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { EditorMap } from '@common/interface';
import { BEFORE_UNLOAD, MapVisibilityEventPayload, SocketEvents, SocketRoom } from '@common/socket-events';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

/** Single source of truth for the available collection of maps
 *  Needed to ensure AdminPage and GameCreation Page visualize the same
 *  maps through the socket interface.
 */

@Injectable({ providedIn: 'root' })
export class MapStateService {
    constructor(private socket: SocketManagerService) {
        this.socket.connect();

        // Adds event listener to disconnects the client socket when the application is closed
        window.addEventListener(BEFORE_UNLOAD, () => {
            this.socket.disconnect();
        });

        this.loadMaps();
    }

    private mapsSubject = new BehaviorSubject<EditorMap[]>([]);
    maps$ = this.mapsSubject.asObservable();

    readonly state = signal<MapLoadState>(MapLoadState.Idle);
    private readonly mapApiService = inject(MapApiService);

    /** MAPS API METHODS */
    loadMaps(): void {
        this.state.set(MapLoadState.Loading);
        this.mapApiService.getAllMaps().subscribe({
            next: maps => {
                this.mapsSubject.next(maps);
                this.state.set(MapLoadState.Loaded);
            },
            error: () => this.state.set(MapLoadState.Error),
        });
    }

    async createMap(map: EditorMap): Promise<void> {
        await firstValueFrom(this.mapApiService.saveMap(map));
    }

    deleteMap(map: EditorMap): void {
        this.mapApiService.deleteMap(map.id).subscribe({
            next: () => this.deleteSubjectMap(map.id),
            error: () => this.state.set(MapLoadState.Error),
        });
    }

    toggleMapVisibility(map: EditorMap): void {
        this.mapApiService.updateMapVisibility(map.id, !map.visibility).subscribe({
            next: () => this.toggleVisibility(map.id, !map.visibility),
            error: () => this.state.set(MapLoadState.Error),
        });
    }

    /** SOCKET SERVICE FOR MAP */
    subscribeToMapEvents() {
        this.socket.send(SocketEvents.JoinRoom, SocketRoom.MapManagementRoom);
        this.socket.on<EditorMap>(SocketEvents.MapCreated, this.onMapCreated);
        this.socket.on<EditorMap>(SocketEvents.MapUpdated, this.onMapUpdated);
        this.socket.on<string>(SocketEvents.MapDeleted, this.onMapDeleted);
        this.socket.on<MapVisibilityEventPayload>(SocketEvents.ToogleMapVisibility, this.onToggleVisibility);
        this.loadMaps();
    }

    unsubscribeFromMapEvents() {
        this.socket.send<SocketRoom>(SocketEvents.LeaveRoom, SocketRoom.MapManagementRoom);
        this.socket.off(SocketEvents.MapCreated, this.onMapCreated);
        this.socket.off(SocketEvents.MapUpdated, this.onMapUpdated);
        this.socket.off(SocketEvents.MapDeleted, this.onMapDeleted);
        this.socket.off(SocketEvents.ToogleMapVisibility, this.onToggleVisibility);
    }

    private onMapCreated = (map: EditorMap) => {
        this.mapsSubject.next([...this.mapsSubject.value, map]);
    };

    private onMapUpdated = (updatedMap: EditorMap) => {
        this.mapsSubject.next(this.mapsSubject.value.map(map => map.id === updatedMap.id ? { ...updatedMap } : map));
    };

    private onMapDeleted = (mapId: string) => {
        this.deleteSubjectMap(mapId);
    };

    private onToggleVisibility = (payload: MapVisibilityEventPayload) => {
        this.toggleVisibility(payload.id, payload.visibility);
    };

    /** UTILITY METHODS */
    private deleteSubjectMap(id: string): void {
        this.mapsSubject.next(this.mapsSubject.value.filter(currentMap => currentMap.id !== id));
    }

    private toggleVisibility(id: string, newVisibility: boolean): void {
        this.mapsSubject.next(this.mapsSubject.value.map((item) =>
            (item.id === id ? { ...item, visibility: newVisibility } : item)));
    }


}
