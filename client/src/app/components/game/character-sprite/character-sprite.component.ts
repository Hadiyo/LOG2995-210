import {
    AfterViewInit,
    Component,
    ElementRef,
    ErrorHandler,
    Input,
    OnChanges,
    OnDestroy,
    SimpleChanges,
    ViewChild,
} from '@angular/core';
import { getFrameIndex } from '@app/shared/character/character-frame-map';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import {
    CANVAS_CLEAR_X,
    CANVAS_CLEAR_Y,
    DEFAULT_AVATAR_ID,
    DEFAULT_SCALE,
    DEFAULT_SPRITE_SIZE,
    FALLBACK_AVATAR_ID,
    getSpriteSheetPath,
    MIN_CANVAS_SIZE,
    SPRITE_GRID_COLS,
    SPRITE_GRID_ROWS,
} from './character-sprite.constants';

@Component({
    selector: 'app-character-sprite',
    standalone: true,
    imports: [],
    templateUrl: './character-sprite.component.html',
    styleUrl: './character-sprite.component.scss',
})
export class CharacterSpriteComponent implements AfterViewInit, OnChanges, OnDestroy {
    // Canvas ref to draw the selected frame.
    @ViewChild('canvasElement', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

    @Input() avatarId = DEFAULT_AVATAR_ID;
    @Input() state: CharacterState = 'idle';
    @Input() direction: CharacterDirection = 'front';
    // Destination sprite render size.
    @Input() width = DEFAULT_SPRITE_SIZE;
    @Input() height = DEFAULT_SPRITE_SIZE;
    // Pixel scaling multiplier for canvas resolution.
    @Input() scale = DEFAULT_SCALE;
    
    // Canvas image smoothing toggle.
    @Input() smoothingEnabled = true;
    // If true, sprite fills host box and resizes with it.
    @Input() fitToHost = false;

    // Optional aria-label for accessibility.
    @Input() ariaLabel: string | null = null;

    private context: CanvasRenderingContext2D | null = null;
    private isDestroyed = false;
    private resizeObserver: ResizeObserver | null = null;
    private image: HTMLImageElement | null = null;
    private currentImagePath = '';

    // hostRef is used for fitToHost canvas size.
    constructor(
        private readonly hostRef: ElementRef<HTMLElement>,
        // Injected to capture image loading errors without breaking Lint about no direct console calls.
        private readonly errorHandler: ErrorHandler,
    ) {}

    ngAfterViewInit(): void {
        // Acquire 2D context once canvas exists.
        this.context = this.canvasRef.nativeElement.getContext('2d');
        if (this.fitToHost) {
            this.startResizeObserver();
            this.resizeCanvasToHost();
        } else {
            this.resizeCanvas(this.width, this.height, this.scale);
        }
        // Load sheet and render initial frame.
        void this.ensureImageLoadedAndRender();
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Ignore input changes before canvas context exists.
        if (!this.context) return;

        this.handleCanvasSizeChanges(changes);
        this.handleVisualChanges(changes);
    }

    ngOnDestroy(): void {
        this.isDestroyed = true;
        this.stopResizeObserver();
    }

    // Set internal canvas resolution (actual pixel buffer size).
    private resizeCanvas(width: number, height: number, scale: number): void {
        const canvas = this.canvasRef.nativeElement;
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
    }

    // React to size-related input changes.
    private handleCanvasSizeChanges(changes: SimpleChanges): void {
        if (!this.fitToHost && (changes.width || changes.height || changes.scale)) {
            this.resizeCanvas(this.width, this.height, this.scale);
            this.renderFrame();
        }

        if (changes.fitToHost && !changes.fitToHost.firstChange) {
            if (this.fitToHost) {
                this.startResizeObserver();
                this.resizeCanvasToHost();
            } else {
                this.stopResizeObserver();
                this.resizeCanvas(this.width, this.height, this.scale);
            }
            this.renderFrame();
        }
    }

    // React to avatar/state/direction/smoothing input changes.
    private handleVisualChanges(changes: SimpleChanges): void {
        if (changes.avatarId && !changes.avatarId.firstChange) {
            // New avatar sheet path: reload image then render.
            void this.ensureImageLoadedAndRender();
            return;
        }

        // Same sheet, different frame or smoothing: re-render only.
        if (changes.state || changes.direction || changes.smoothingEnabled) {
            this.renderFrame();
        }
    }

    // Build sheet path from avatar id.
    private getImagePath(): string {
        return getSpriteSheetPath(this.avatarId);
    }

    // Lazy-load current avatar image and render once ready.
    private async ensureImageLoadedAndRender(): Promise<void> {
        if (!this.context) return;

        const imagePath = this.getImagePath();
        if (this.currentImagePath !== imagePath || !this.image) {
            this.image = await this.loadImage(imagePath);
            this.currentImagePath = imagePath;
        }

        if (this.isDestroyed) return;
        this.renderFrame();
    }

    // Loads image path; on error fallback to avatar 0.
    private loadImage(path: string): Promise<HTMLImageElement> {
        return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => {
                const fallbackPath = getSpriteSheetPath(FALLBACK_AVATAR_ID);
                if (path === fallbackPath) {
                    // Fallback also failed, resolve with empty image and log error.
                    this.errorHandler.handleError(new Error(`[CharacterSprite] Fallback sprite failed: ${path}`));
                    resolve(image);
                    return;
                }

                // Failed to load requested avatar sheet, fallback to default avatar 0 sheet.
                this.errorHandler.handleError(new Error(`[CharacterSprite] Sprite failed: ${path}. Fallback: ${fallbackPath}`));
                void this.loadImage(fallbackPath).then(resolve);
            };
            image.src = path;
        });
    }

    // Draw one frame from the 4x4 spritesheet into full canvas.
    private renderFrame(): void {
        if (!this.context || !this.image) return;

        const canvas = this.canvasRef.nativeElement;
        const frameIndex = getFrameIndex(this.state, this.direction);

        // Each frame cell size in source sheet.
        const frameWidth = this.image.width / SPRITE_GRID_COLS;
        const frameHeight = this.image.height / SPRITE_GRID_ROWS;

        // Convert linear index into (col,row).
        const column = frameIndex % SPRITE_GRID_COLS;
        const row = Math.floor(frameIndex / SPRITE_GRID_COLS);

        this.context.imageSmoothingEnabled = this.smoothingEnabled;
        this.context.clearRect(CANVAS_CLEAR_X, CANVAS_CLEAR_Y, canvas.width, canvas.height);

        // Crop selected frame and stretch it to canvas size.
        this.context.drawImage(
            this.image,
            column * frameWidth,
            row * frameHeight,
            frameWidth,
            frameHeight,
            CANVAS_CLEAR_X,
            CANVAS_CLEAR_Y,
            canvas.width,
            canvas.height,
        );
    }

    // Fit canvas to current host element dimensions.
    private resizeCanvasToHost(): void {
        const host = this.hostRef.nativeElement;
        const width = Math.max(host.clientWidth, MIN_CANVAS_SIZE);
        const height = Math.max(host.clientHeight, MIN_CANVAS_SIZE);

        const canvas = this.canvasRef.nativeElement;
        canvas.width = width;
        canvas.height = height;
        this.renderFrame();
    }

    // Watch host resizes in fit mode.
    private startResizeObserver(): void {
        this.stopResizeObserver();
        this.resizeObserver = new ResizeObserver(() => this.resizeCanvasToHost());
        this.resizeObserver.observe(this.hostRef.nativeElement);
    }

    // Stop watching host resizes.
    private stopResizeObserver(): void {
        if (!this.resizeObserver) return;
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
    }
}
