import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class TimeService {
    // TODO : Permettre plus qu'une minuterie à la fois
    private interval: number | undefined;
    private readonly tick = 1000;

    private counter = signal(0);
    readonly time = this.counter.asReadonly();

    startTimer(startValue: number) {
        if (this.interval) return;
        this.counter.set(startValue);
        this.interval = window.setInterval(() => {
            if (this.counter() > 0) {
                this.counter.update((value) => value - 1);
            } else {
                this.stopTimer();
            }
        }, this.tick);
    }

    stopTimer() {
        clearInterval(this.interval);
        this.interval = undefined;
    }
}
