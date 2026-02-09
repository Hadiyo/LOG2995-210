import { inject, Injectable, signal } from '@angular/core';
import { MapApiService } from '@app/services/map/map-api.service';
import { MapLoadState } from '@app/services/map/map-state.enum';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { EditorMap } from '@common/interface';
import { SocketEvents, SocketRoom } from '@common/socket-events';
import { BehaviorSubject } from 'rxjs';

/** Single source of truth for the available collection of maps
 *  Needed to ensure AdminPage and GameCreation Page visualize the same
 *  maps through the socket interface.
 */

@Injectable({ providedIn: 'root' })
export class MapStateService {
    constructor(private socket: SocketManagerService) {
        // Connect user to the map management room to receive map updates only
        this.socket.send<SocketRoom>(SocketEvents.JoinRoom, SocketRoom.MapManagementRoot);

        // Subscribe immediately to socket events related to map events
        this.createMapSocketEvent();
        this.updateMapSocketEvent();
        this.deleteMapSocketEvent();
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

    deleteMap(map: EditorMap): void {
        this.mapApiService.deleteMap(map.id).subscribe({
            next: () => this.deleteSubjectMap(map.id),
            error: () => this.state.set(MapLoadState.Error),
        });
    }

    toggleMapVisibility(map: EditorMap): void {
        const newVisibility = !map.visibility;
        this.mapApiService.updateMapVisibility(map.id, newVisibility).subscribe({
            next: () => this.mapsSubject.next(this.mapsSubject.value.map((item) =>
                (item.id === map.id ? { ...item, visibility: newVisibility } : item))),
            error: () => this.state.set(MapLoadState.Error),
        });
    }

    /** SOCKET SERVICE FOR MAP */
    private createMapSocketEvent(): void {
        this.socket.on<EditorMap>(SocketEvents.MapCreated, (createdMap: EditorMap) => {
            this.mapsSubject.next([...this.mapsSubject.value, createdMap]);
        });
    }

    private updateMapSocketEvent(): void {
        this.socket.on<EditorMap>(SocketEvents.MapUpdated, (updatedMap: EditorMap) => {
            this.mapsSubject.next(
                this.mapsSubject.value.map(map =>
                    map.id === updatedMap.id
                        ? { ...updatedMap }
                        : map,
                ),
            );
        });
    }

    private deleteMapSocketEvent(): void {
        this.socket.on<string>(SocketEvents.MapDeleted, (mapId: string) => {
            this.deleteSubjectMap(mapId);
        });
    }

    /** UTILITY METHODS */
    private deleteSubjectMap(id: string): void {
        this.mapsSubject.next(this.mapsSubject.value.filter(currentMap => currentMap.id !== id));
    }


}
