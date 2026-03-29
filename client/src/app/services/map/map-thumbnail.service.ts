import { Injectable } from '@angular/core';
import { resolveAssetUrl } from '@app/utils/asset-url.util';
import { MAX_PREVIEW_IMAGE_BASE64_LENGTH } from '@common/constants';
import { PreviewImageFormat } from '@common/enum';
import { ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorMap, MapObject } from '@common/maps/map.interface';

// Shared canvas geometry used by all draw steps (cell size + canvas ref)
type Geom = { canvas: HTMLCanvasElement; cellW: number; cellH: number };

type TileRenderConfig = {
    cols: number;
    rows: number;
    geom: Geom; // precomputed canvas + cell geometry
    imgByUrl: Map<string, HTMLImageElement>;
    tiles: TileType[];
    walkables: boolean[];
};

// PreviewImage result, must include both data and format
type PreviewImage = { data: string; format: PreviewImageFormat };

/* =========================================================
   Canvas configuration
   ========================================================= */

// Pixel size for the preview canvas (square)
// we can reduce to 100 to save memory if needed
const PIXEL_SIZE = 200;

/* =========================================================
   Image export configuration
   ========================================================= */

// WebP quality setting (0 to 1)
const PREVIEW_QUALITY = 0.6;
const PREVIEW_FORMAT = PreviewImageFormat.WEBP;
const FALLBACK_FORMAT = PreviewImageFormat.PNG;

@Injectable({ providedIn: 'root' })
export class MapThumbnailService {

    /* =========================================================
       Object rendering tweaks
       ========================================================= */

    /**
     * Object padding is tuned to visually match editor rendering:
     * - FLAG uses 70% size in editor → 15% padding
     * - START is slightly inset to avoid touching grid lines
     */
    private readonly objectPaddingByType: Partial<Record<ObjectType, number>> = {
        [ObjectType.FLAG]: 0.15,
        [ObjectType.START]: 0.05,
    };

    /* =========================================================
       Public API
       ========================================================= */

    /**
     * Generate a base64 preview image from an EditorMap.
     * Returns WebP when supported; falls back to PNG.
     */
    async generatePreview(map: EditorMap): Promise<PreviewImage | null> {
        // Get 2D drawing context
        const ctx = this.createContext();
        // if context is missing, skip drawing
        if (!ctx) return null;

        // Extract canvas from context
        const { canvas } = ctx;
        // Get map dimensions and setup canvas
        const cols = map.size; const 
rows = map.size;
        const geom = this.setupCanvas(canvas, ctx, cols, rows);

        // Draw the preview frame
        await this.drawPreview(ctx, geom, cols, rows, map);
        // Export to WebP or PNG
        return this.tryExportWebp(canvas) ?? this.tryExportPng(canvas);
    }

    private createContext(): CanvasRenderingContext2D | null {
        // Get 2D drawing context
        const canvas = document.createElement('canvas');
        return canvas.getContext('2d');
    }

    private async drawPreview(
        ctx: CanvasRenderingContext2D,
        geom: Geom,
        cols: number,
        rows: number,
        map: EditorMap,
    ): Promise<void> {
        const tiles = map.map.map((cell) => cell.tileType);
        const walkables = map.map.map((cell) => cell.isWalkable);
        const objects = map.objects ?? [];

        // Load (and cache) images for the tiles/objects used in this frame
        const imgByUrl = await this.preloadImages(cols, rows, tiles, walkables, objects);

        // Draw tiles, objects, and grid overlay
        this.drawTiles(ctx, { cols, rows, geom, imgByUrl, tiles, walkables });
        this.drawObjects(ctx, geom, imgByUrl, objects);
        this.drawGrid(ctx, cols, rows, geom);
    }

    private tryExportWebp(canvas: HTMLCanvasElement): PreviewImage | null {
        // Export to WebP with quality setting
        const webpMime = `image/${PREVIEW_FORMAT}`;
        const webp = canvas.toDataURL(webpMime, PREVIEW_QUALITY);
        if (webp.startsWith('data:' + webpMime)) {
            const base64 = this.stripDataUrl(webp);
            if (base64.length <= MAX_PREVIEW_IMAGE_BASE64_LENGTH) {
                return { data: base64, format: PREVIEW_FORMAT };
            }
        }
        return null;
    }

    private tryExportPng(canvas: HTMLCanvasElement): PreviewImage | null {
        // Fallback to PNG if WebP is unsupported or too large
        const pngMime = `image/${FALLBACK_FORMAT}`;
        const png = canvas.toDataURL(pngMime);
        const base64Png = this.stripDataUrl(png);
        if (base64Png.length <= MAX_PREVIEW_IMAGE_BASE64_LENGTH) {
            return { data: base64Png, format: FALLBACK_FORMAT };
        }
        // Both formats exceeded size limit, return null
        // Should not happen in current configuration
        return null;
    }

    // Removes the "data:image/xxx;base64," prefix from a data URL
    // For storing just the base64-encoded string, for database efficiency
    private stripDataUrl(dataUrl: string): string {
        const comma = dataUrl.indexOf(',');
        return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    }


    /* =========================================================
       Canvas geometry helpers
       ========================================================= */

    /**
     * Sets up a clean drawing surface and returns cell geometry.
     * Preview is image-only so we clear to transparent.
     */
    private setupCanvas(
        canvas: HTMLCanvasElement,
        ctx: CanvasRenderingContext2D,
        cols: number,
        rows: number,
    ): Geom {
        canvas.width = PIXEL_SIZE;
        canvas.height = PIXEL_SIZE;

        // Clear to transparent
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        return {
            canvas,
            cellW: canvas.width / cols,
            cellH: canvas.height / rows,
        };
    }

    /* =========================================================
       Draw tiles
       ========================================================= */

    /**
     * Draws each tile cell using sprite images.
     */
    private drawTiles(
        ctx: CanvasRenderingContext2D,
        config: TileRenderConfig,
    ): void {
        const { cols, rows, geom, imgByUrl, tiles, walkables } = config;
        const total = cols * rows;

        for (let i = 0; i < total; i++) {
            const x = i % cols;
            const y = Math.floor(i / cols);

            const tile = tiles[i] ?? TileType.DIRT;
            const walkable = walkables[i];

            // Get tile image, walkable only used for doors
            // if a door is open (walkable=true), if closed (walkable=false)
            const url = this.tileUrl(tile, walkable);
            const img = imgByUrl.get(url);
            if (!img) continue;

            // Draw tile image in cell
            ctx.drawImage(img, x * geom.cellW, y * geom.cellH, geom.cellW, geom.cellH);
        }
    }

    /* =========================================================
       Draw objects
       ========================================================= */

    /**
     * Draws objects on top of tiles.
     * - 1x1 objects use padding for better visual alignment.
     * - 2x2 objects are drawn full cell span with no padding.
     */
    private drawObjects(
        ctx: CanvasRenderingContext2D,
        geom: Geom,
        imgByUrl: Map<string, HTMLImageElement>,
        objects: MapObject[],
    ): void {
        for (const o of objects ?? []) {
            // Get object image URL
            const url = this.objectUrl(o.type);
            if (!url) continue;
            // Get preloaded image
            const img = imgByUrl.get(url);
            if (!img) continue;

            // Determine span in cells (1x1 or 2x2)
            const span = o.size === ObjectSize.L ? 2 : 1;

            // Calculate pixel position and size
            const px = o.position.x * geom.cellW;
            const py = o.position.y * geom.cellH;
            const pw = span * geom.cellW;
            const ph = span * geom.cellH;

            // Apply padding for small objects only
            const padFactor =
                o.size === ObjectSize.S ? this.objectPaddingByType[o.type] ?? 0 : 0;
            const padX = pw * padFactor;
            const padY = ph * padFactor;

            // Draw object image in cell(s)
            ctx.drawImage(img, px + padX, py + padY, pw - padX * 2, ph - padY * 2);
        }
    }

    /* =========================================================
       Draw grid overlay
       ========================================================= */

    /**
     * Draws a subtle grid on top of the preview.
     */
    private drawGrid(ctx: CanvasRenderingContext2D, cols: number, rows: number, geom: Geom): void {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * geom.cellW, 0);
            ctx.lineTo(x * geom.cellW, geom.canvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * geom.cellH);
            ctx.lineTo(geom.canvas.width, y * geom.cellH);
            ctx.stroke();
        }
    }

    /* =========================================================
       Theme-driven asset resolution (CSS variables)
       ========================================================= */

    // cache for CSS image variable lookups
    private readonly cssImageVarCache = new Map<string, string>();

    /**
     * Reads a CSS variable that stores an image url(...),
     * and converts it into a raw image src string for JS Image().
     */
    private getCssImageVar(varName: string): string {
        // Check cache first, to avoid repeated DOM reads
        const cached = this.cssImageVarCache.get(varName);
        if (cached !== undefined) return cached;

        // Read the raw CSS variable value
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();

        // url("...") -> ...
        const value = raw.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
        const resolved = this.resolveImageUrl(value);
        // Cache and return the value
        this.cssImageVarCache.set(varName, resolved);
        return resolved;
    }

    private resolveImageUrl(url: string): string {
        if (!url || /^(data:|https?:|blob:)/.test(url)) return url;
        return resolveAssetUrl(url);
    }

    /**
     * Returns tile sprite url based on tile type (and door open/closed state).
     * All assets are defined in the global theme variables.
     */
    private tileUrl(tile: TileType, isWalkable?: boolean): string {
        // isWalkable is only relevant for DOOR tiles
        // if a door is open (walkable=true), if closed (walkable=false)
        if (tile === TileType.DOOR) {
            return this.getCssImageVar(isWalkable ? '--tile-door-open-img' : '--tile-door-closed-img');
        }

        switch (tile) {
            case TileType.WALL:
                return this.getCssImageVar('--tile-wall-img');
            case TileType.WATER:
                return this.getCssImageVar('--tile-water-img');
            case TileType.ICE:
                return this.getCssImageVar('--tile-ice-img');
            case TileType.DIRT:
            default:
                return this.getCssImageVar('--tile-dirt-img');
        }
    }

    /**
     * Returns object sprite url based on object type.
     * Assets are theme-defined to allow future skin swaps with no TS changes.
     */
    private objectUrl(type: ObjectType): string {
        switch (type) {
            case ObjectType.START:
                return this.getCssImageVar('--object-spawn-img');
            case ObjectType.FLAG:
                return this.getCssImageVar('--object-flag-img');
            case ObjectType.REGEN:
                return this.getCssImageVar('--object-heal-img');
            case ObjectType.ARENA:
                return this.getCssImageVar('--object-fight-img');
            default:
                return '';
        }
    }

    /* =========================================================
       Image preloading (cached)
       ========================================================= */

    /**
     * Computes the minimal set of image URLs required to render
     * the current preview frame (tiles + objects).
     *
     * - Uses a Set to avoid duplicate URLs
     * - Only collects assets that are actually used on this map
     *   (no eager loading of unused sprites)
     */
    private collectUrls(
        cols: number,
        rows: number,
        tiles: TileType[],
        walkables: boolean[],
        objects: MapObject[],
    ): string[] {
        const urls = new Set<string>();
        const total = cols * rows;

        // Tile sprites used by the map grid
        for (let i = 0; i < total; i++) {
            const tile = tiles[i] ?? TileType.DIRT;
            const walkable = walkables[i];
            urls.add(this.tileUrl(tile, walkable));
        }

        // Object sprites used by placed objects
        for (const object of objects ?? []) {
            const objectImageUrl = this.objectUrl(object.type);
            if (objectImageUrl) urls.add(objectImageUrl);
        }

        return Array.from(urls);
    }

    /**
     * Ensures all images required for the current frame are loaded
     * before drawing begins.
     *
     * - Loads all assets in parallel
     * - Uses Promise.allSettled so a missing or broken image
     *   does NOT prevent the preview from rendering
     * - Returns a lookup map for fast, synchronous draw calls
     */
    private async preloadImages(
        cols: number,
        rows: number,
        tiles: TileType[],
        walkables: boolean[],
        objects: MapObject[],
    ): Promise<Map<string, HTMLImageElement>> {
        // Gather required URLs
        const urls = this.collectUrls(cols, rows, tiles, walkables, objects);
        const loaded = await Promise.allSettled(urls.map((url) => this.loadImage(url)));

        // Build lookup map of successfully loaded images
        const imgByUrl = new Map<string, HTMLImageElement>();
        for (let i = 0; i < urls.length; i++) {
            const result = loaded[i];
            if (result.status === 'fulfilled') {
                imgByUrl.set(urls[i], result.value);
            }
        }

        return imgByUrl;
    }

    /**
     * Shared image cache (static):
     * - Persists across component instances
     * - Stores Promises, not resolved images, to deduplicate
     *   concurrent load requests
     */
    private static cache = new Map<string, Promise<HTMLImageElement>>();

    /**
     * Loads an image by URL with caching.
     *
     * - If the image is already loading or loaded, returns
     *   the existing Promise
     * - Otherwise, starts loading and immediately caches
     *   the Promise to avoid duplicate requests
     */
    private loadImage(url: string): Promise<HTMLImageElement> {
        // Check cache first
        const cached = MapThumbnailService.cache.get(url);
        if (cached) return cached;

        // Start loading the image
        const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load ${url}`));
            img.src = url;
        });

        // Cache the loading Promise
        MapThumbnailService.cache.set(url, loadPromise);
        return loadPromise;
    }
}
