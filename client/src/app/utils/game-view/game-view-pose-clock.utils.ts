import { WritableSignal } from '@angular/core';

export function startLocalPoseRefreshClock(nowMs: WritableSignal<number>, intervalMs: number): number {
    return window.setInterval(() => {
        nowMs.set(Date.now());
    }, intervalMs);
}

export function stopLocalPoseRefreshClock(intervalId: number | null): null {
    if (intervalId !== null) {
        window.clearInterval(intervalId);
    }

    return null;
}
