import { Map, MapDocument } from '@app/model/database/map';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { MAX_PREVIEW_IMAGE_BASE64_LENGTH } from '@common/constants';
import { PreviewImageFormat } from '@common/enum';
import { getCellPositionAtIndex } from '@common/maps/map-utils';
import { ObjectSize, TileType } from '@common/maps/map.enums';
import { EditorCell, EditorMap, MapObject, Vec2 } from '@common/maps/map.interface';
import { SocketEvents } from '@common/socket-events';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter } from 'events';
import type { Model } from 'mongoose';

type PersistedCell = Omit<EditorCell, 'isWalkable' | 'isOccupied'> & { doorOpen?: boolean };
type PersistedMap = Omit<EditorMap, 'id' | 'map'> & { map: PersistedCell[] };

type PersistedMapRecord = Omit<EditorMap, 'id' | 'map'> & {
    _id: string;
    map: PersistedCell[];
    objects: MapObject[];
    createdAt?: Date;
    updatedAt?: Date;
};

@Injectable()
export class MapService {
    private readonly mapEventEmitter = new EventEmitter();

    constructor(@InjectModel(Map.name) private readonly mapModel: Model<MapDocument>) {}

    async getAllMaps(): Promise<EditorMap[]> {
        const maps = await this.mapModel.find().sort({ createdAt: 1 }).exec();
        return maps.map((map) => this.toEditorMap(map));
    }

    async getVisibleMaps(): Promise<EditorMap[]> {
        const maps = await this.mapModel.find({ visibility: true }).sort({ createdAt: 1 }).exec();
        return maps.map((map) => this.toEditorMap(map));
    }

    async getMapById(id: string): Promise<EditorMap> {
        const map = await this.mapModel.findById(id).exec();
        if (!map) {
            throw new NotFoundException('Map not found');
        }
        return this.toEditorMap(map);
    }

    async createMap(map: EditorMap): Promise<EditorMap> {
        await this.ensureMapIsValid(map);
        const created = await this.insertMap(map);
        const editorMap = this.toEditorMap(created);
        this.mapEventEmitter.emit(SocketEvents.MapCreated, editorMap);
        return editorMap;
    }

    async updateMap(id: string, map: EditorMap): Promise<EditorMap> {
        await this.ensureMapIsValid(map, id);

        const updated = await this.mapModel.findByIdAndUpdate(id, this.buildMapPayload(map), { new: true }).exec();
        if (updated) {
            const oldMap = this.toEditorMap(updated);
            this.mapEventEmitter.emit(SocketEvents.MapUpdated, oldMap);
            return oldMap;
        }

        const created = await this.insertMap(map);
        const newMap = this.toEditorMap(created);
        this.mapEventEmitter.emit(SocketEvents.MapCreated, newMap);
        return newMap;
    }

    async updateMapVisibility(id: string, isVisible: boolean): Promise<void> {
        const updated = await this.mapModel.findByIdAndUpdate(id, { visibility: isVisible }, { new: true }).exec();
        if (!updated) {
            throw new NotFoundException('Map not found');
        }
        const updatedMap = this.toEditorMap(updated);
        const payload = {
            id: updatedMap.id,
            isVisible: updatedMap.visibility,
        };
        this.mapEventEmitter.emit(SocketEvents.ToogleMapVisibility, payload);
    }

    async deleteMap(id: string): Promise<void> {
        const result = await this.mapModel.deleteOne({ _id: id }).exec();
        if (result.deletedCount === 0) {
            throw new NotFoundException('Map already deleted or missing');
        } else {
            this.mapEventEmitter.emit(SocketEvents.MapDeleted, id);
        }
    }

    private async ensureMapIsValid(map: EditorMap, excludeId?: string): Promise<void> {
        const isNameUnique = createNameUniquenessChecker(this.mapModel, { excludeId });
        const validation = await validateMapOnServer(map, isNameUnique);
        if (validation.isValid) return;

        throw new BadRequestException(validation);
    }

    private async insertMap(map: EditorMap): Promise<MapDocument> {
        const payload = this.buildMapPayload(map);
        return this.mapModel.create(payload);
    }

    private buildMapPayload(map: EditorMap): PersistedMap {
        const now = new Date().toISOString();
        // Validate and sanitize preview image and format
        const { previewImage, previewImageFormat } = this.validateMapPreview(
            map.previewImage,
            map.previewImageFormat,
        );

        return {
            name: map.name.trim(),
            description: map.description.trim(),
            mode: map.mode,
            size: map.size,
            date: now,
            map: map.map.map((cell) => ({
                tileType: cell.tileType,
                ...(cell.tileType === TileType.DOOR ? { doorOpen: cell.isWalkable === true } : {}),
            })),
            objects: map.objects,
            visibility: map.visibility,
            // Validated preview image and format
            previewImage,
            previewImageFormat,
        };
    }

    // Validate preview image and format before saving to DB
    private validateMapPreview(
        previewImage: EditorMap['previewImage'],
        previewImageFormat: EditorMap['previewImageFormat'],
    ): { previewImage?: string; previewImageFormat?: PreviewImageFormat } {
        // Validate preview image and format
        const isValidFormat =
            previewImageFormat === PreviewImageFormat.WEBP ||
            previewImageFormat === PreviewImageFormat.PNG;
        // Validate preview image base64 string
        const isValidPreview =
            typeof previewImage === 'string' &&
            previewImage.length <= MAX_PREVIEW_IMAGE_BASE64_LENGTH &&
            /^[A-Za-z0-9+/=]+$/.test(previewImage);

        return {
            previewImage: isValidPreview ? previewImage : undefined,
            previewImageFormat: isValidPreview && isValidFormat ? previewImageFormat : undefined,
        };
    }


    private toEditorMap(mapDocument: MapDocument): EditorMap {
        const mapObject = mapDocument.toObject({ versionKey: false });
        const { _id: idValue, map: persistedMap, objects, ...rest } = mapObject as PersistedMapRecord;

        delete (rest as { createdAt?: Date }).createdAt;
        delete (rest as { updatedAt?: Date }).updatedAt;
        const occupied = this.buildOccupiedKeySet(objects);
        const hydratedMap: EditorCell[] = persistedMap.map((cell, index) => {
            const isWalkable = this.isTileWalkable(cell.tileType, cell.doorOpen);
            const position = getCellPositionAtIndex(index, mapDocument.size);
            const key = `${position.x},${position.y}`;
            return {
                tileType: cell.tileType,
                isWalkable,
                isOccupied: occupied.has(key),
            };
        });
        return {
            ...rest,
            map: hydratedMap,
            objects,
            id: idValue.toString(),
            // Preview image and format
            previewImage: mapObject.previewImage,
            previewImageFormat: mapObject.previewImageFormat,
        };
    }

    private isTileWalkable(tileType: TileType, doorOpen?: boolean): boolean {
        if (tileType === TileType.WALL) return false;
        if (tileType === TileType.DOOR) return doorOpen === true;
        return true;
    }

    private buildOccupiedKeySet(objects: MapObject[]): Set<string> {
        const occupied = new Set<string>();
        for (const object of objects) {
            for (const pos of this.getCoveredPositions(object.position, object.size)) {
                occupied.add(`${pos.x},${pos.y}`);
            }
        }
        return occupied;
    }

    private getCoveredPositions(position: Vec2, size: ObjectSize): Vec2[] {
        if (size === ObjectSize.S) {
            return [{ ...position }];
        }
        return [
            { ...position },
            { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y + 1 },
            { x: position.x + 1, y: position.y + 1 },
        ];
    }

    // Event emitter utility functions
    on<T>(event: SocketEvents, callback: (payload: T) => void) {
        this.mapEventEmitter.on(event, callback);
    }

    off<T>(event: SocketEvents, callback: (payload: T) => void) {
        this.mapEventEmitter.off(event, callback);
    }
}
