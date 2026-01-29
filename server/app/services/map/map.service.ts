import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ObjectSize, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapObject, Vec2 } from '@common/interface';
import { Map, MapDocument } from '@app/model/database/map';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';

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
        return this.toEditorMap(created);
    }

    async updateMap(id: string, map: EditorMap): Promise<EditorMap> {
        await this.ensureMapIsValid(map, id);

        const updated = await this.mapModel.findByIdAndUpdate(id, this.buildMapPayload(map), { new: true }).exec();
        if (updated) {
            return this.toEditorMap(updated);
        }

        const created = await this.insertMap(map);
        return this.toEditorMap(created);
    }

    async updateMapVisibility(id: string, isVisible: boolean): Promise<EditorMap> {
        const updated = await this.mapModel.findByIdAndUpdate(id, { visibility: isVisible }, { new: true }).exec();
        if (!updated) {
            throw new NotFoundException('Map not found');
        }
        return this.toEditorMap(updated);
    }

    async deleteMap(id: string): Promise<void> {
        const result = await this.mapModel.deleteOne({ _id: id }).exec();
        if (result.deletedCount === 0) {
            throw new NotFoundException('Map already deleted or missing');
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
        return {
            name: map.name.trim(),
            description: map.description.trim(),
            mode: map.mode,
            size: map.size,
            date: now,
            map: map.map.map((cell) => ({
                position: cell.position,
                tileType: cell.tileType,
                ...(cell.tileType === TileType.DOOR ? { doorOpen: cell.isWalkable === true } : {}),
            })),
            objects: map.objects,
            visibility: false,
        };
    }

    private toEditorMap(mapDocument: MapDocument): EditorMap {
        const mapObject = mapDocument.toObject({ versionKey: false }) as PersistedMapRecord;
        const { _id: idValue, map: persistedMap, objects, ...rest } = mapObject;
        delete (rest as { createdAt?: Date }).createdAt;
        delete (rest as { updatedAt?: Date }).updatedAt;
        const occupied = this.buildOccupiedKeySet(objects);
        const hydratedMap: EditorCell[] = persistedMap.map((cell) => {
            const isWalkable = this.isTileWalkable(cell.tileType, cell.doorOpen);
            const key = `${cell.position.x},${cell.position.y}`;
            return {
                position: cell.position,
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
}
