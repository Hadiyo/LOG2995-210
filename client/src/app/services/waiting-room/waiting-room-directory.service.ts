import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { WaitingRoomEvents } from '@common/socket-events';
import { environment } from 'src/environments/environment';

type DirectoryState = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class WaitingRoomDirectoryService {
    readonly previews = signal<WaitingRoomPreview[]>([]);
    readonly state = signal<DirectoryState>('idle');
    readonly errorMessage = signal('');

    private readonly availableWaitingRoomsUrl = `${environment.serverUrl}/waiting-rooms/available`;
    private listenersRegistered = false;

    constructor(
        private readonly http: HttpClient,
        private readonly socketManager: SocketManagerService,
    ) {}

    init(): void {
        if (!this.socketManager.isSocketAlive()) {
            this.socketManager.connect();
        }

        if (!this.listenersRegistered) {
            this.socketManager.on(WaitingRoomEvents.WaitingRoomDirectoryUpdated, this.handleDirectoryUpdated);
            this.listenersRegistered = true;
        }

        this.refresh();
    }

    destroy(): void {
        if (!this.listenersRegistered) {
            return;
        }

        this.socketManager.off(WaitingRoomEvents.WaitingRoomDirectoryUpdated, this.handleDirectoryUpdated);
        this.listenersRegistered = false;
    }

    refresh(): void {
        this.state.set('loading');
        this.http.get<WaitingRoomPreview[]>(this.availableWaitingRoomsUrl).subscribe({
            next: (previews) => {
                this.previews.set(previews);
                this.errorMessage.set('');
                this.state.set('loaded');
            },
            error: () => {
                this.previews.set([]);
                this.errorMessage.set('Impossible de charger les parties disponibles.');
                this.state.set('error');
            },
        });
    }

    private handleDirectoryUpdated = (): void => {
        this.refresh();
    };
}
