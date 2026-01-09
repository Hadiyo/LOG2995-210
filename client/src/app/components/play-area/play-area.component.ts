import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { TimeService } from '@app/services/time.service';

// TODO : Avoir un fichier séparé pour les constantes!
export const DEFAULT_WIDTH = 200;
export const DEFAULT_HEIGHT = 200;

// TODO : Déplacer ça dans un fichier séparé accessible par tous
export enum MouseButton {
    Left = 0,
    Middle = 1,
    Right = 2,
    Back = 3,
    Forward = 4,
}

@Component({
    selector: 'app-play-area',
    standalone: true,
    templateUrl: './play-area.component.html',
    styleUrls: ['./play-area.component.scss'],
})
export class PlayAreaComponent {
    buttonPressed = '';
    formattedTime = computed(() => {
        const time = this.timeService.time();
        const MAX_TIME = 60;
        const minutes = Math.floor(time / MAX_TIME)
            .toString()
            .padStart(2, '0');
        const seconds = (time % MAX_TIME).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    });
    timerExpired = signal(false);

    private readonly timer = 5;

    // Injection de dépendance hors du constructeur
    // Équivalent à constructor(priate readonly timeService: TimeService)
    private readonly timeService: TimeService = inject(TimeService);

    constructor() {
        effect(() => {
            this.timerExpired.set(this.timeService.time() <= 2 && this.timeService.time() > 0);
        });
    }

    @HostListener('keydown', ['$event'])
    buttonDetect(event: KeyboardEvent) {
        this.buttonPressed = event.key;
    }

    // TODO : déplacer ceci dans un service de gestion de la souris!
    mouseHitDetect(event: MouseEvent) {
        if (event.button === MouseButton.Left) {
            this.timeService.startTimer(this.timer);
        }
    }
}
