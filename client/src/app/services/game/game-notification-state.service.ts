import { Injectable, signal } from '@angular/core';
import { GameNotification } from '@common/game-notification';
import { GameNotificationPayload } from '@common/game-socket-events';

// Display duration for one notification before auto-clear.
const GAME_NOTIFICATION_DISPLAY_MS = 2400;

@Injectable({
    providedIn: 'root',
})
export class GameNotificationStateService {
    // Currently displayed notification in UI (null when hidden).
    private readonly activeNotificationSignal = signal<GameNotification | null>(null);
    readonly activeNotification = this.activeNotificationSignal.asReadonly();

    // Timer handle used to clear the current notification after display delay.
    private notificationClearTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // Consumes incoming socket payload and updates visible notification state.
    // Guards by current session to avoid cross-session bleed.
    handleIncomingNotification(payload: GameNotificationPayload, currentSessionId: string | null): void {
        if (!currentSessionId || payload.sessionId !== currentSessionId) return;

        const currentNotification = this.activeNotificationSignal();
        if (currentNotification) {
            const currentCreatedAt = Date.parse(currentNotification.createdAt);
            const incomingCreatedAt = Date.parse(payload.notification.createdAt);

            // Ignore out-of-order older notifications when timestamps are valid.
            if (!Number.isNaN(currentCreatedAt) && !Number.isNaN(incomingCreatedAt) && incomingCreatedAt < currentCreatedAt) {
                return;
            }
        }

        // Cancel previous auto-clear timer because a new notification is taking over.
        if (this.notificationClearTimeoutId) {
            clearTimeout(this.notificationClearTimeoutId);
            this.notificationClearTimeoutId = null;
        }

        // Force component remount/repaint so CSS animation restarts for each new event.
        this.activeNotificationSignal.set(null);
        queueMicrotask(() => {
            this.activeNotificationSignal.set(payload.notification);
            this.notificationClearTimeoutId = setTimeout(() => {
                this.activeNotificationSignal.set(null);
                this.notificationClearTimeoutId = null;
            }, GAME_NOTIFICATION_DISPLAY_MS);
        });
    }

    // Clears visible notification and pending timer (used on page/session teardown).
    clear(): void {
        this.activeNotificationSignal.set(null);
        if (!this.notificationClearTimeoutId) return;

        clearTimeout(this.notificationClearTimeoutId);
        this.notificationClearTimeoutId = null;
    }
}
