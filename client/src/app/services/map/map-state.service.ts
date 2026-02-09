import { inject, Injectable, signal } from '@angular/core';
import { MapApiService } from '@app/services/map/map-api.service';
import { EditorMap } from '@common/interface';
import { BehaviorSubject } from 'rxjs';
import { MapLoadState } from './map-state.enum';

/** Single source of truth for the available collection of maps
 *  Needed to ensure AdminPage and GameCreation Page visualize the same
 *  maps through the socket interface.
 */

@Injectable({ providedIn: 'root' })
export class MapStateService {

    private mapsSubject = new BehaviorSubject<EditorMap[]>([]);
    maps$ = this.mapsSubject.asObservable();

    readonly state = signal<MapLoadState>(MapLoadState.Idle);
    private readonly mapApiService = inject(MapApiService);

    /** MAPS METHODS */
    /**
     * Requests all maps from the server and updates the single source of truth
     */
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

    /** SINGLE MAP METHODS */


    deleteMap(map: EditorMap): void {
        this.mapApiService.deleteMap(map.id).subscribe({
            next: () => {
                this.mapsSubject.next(this.mapsSubject.value.filter(currentMap => currentMap.id !== map.id));
            },
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

}
