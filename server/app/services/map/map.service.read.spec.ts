import { NotFoundException } from '@nestjs/common';

import { MapService } from '@app/services/map/map.service';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/enum';
import { PreviewImageFormat } from '@common/interface';
import { makeDoc, makeMapModelMock, makeObject, makeQuery } from './map.service.spec-utils';

/**
 * Testing Strategy:
 * - Maps are properly queried and sorted.
 * 
 * - Returned documents are transformed (hydrated) into client-ready
 *   objects with computed fields such as isWalkable and isOccupied.
 * 
 * - Visibility filters are correctly applied.
 * 
 * - NotFoundException is thrown when a map does not exist.
 */

jest.mock('@app/validators/server-map-validation');

const FIXED_NOW_ISO = '2026-02-08T12:00:00.000Z';

describe('MapService (read)', () => {
    const createNameUniquenessCheckerMock = createNameUniquenessChecker as jest.Mock;
    const validateMapOnServerMock = validateMapOnServer as jest.Mock;

    let mapModel: ReturnType<typeof makeMapModelMock>;
    let service: MapService;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(FIXED_NOW_ISO));

        createNameUniquenessCheckerMock.mockReturnValue(async () => true);
        validateMapOnServerMock.mockResolvedValue({ isValid: true, issues: [] });

        mapModel = makeMapModelMock();
        service = new MapService(mapModel as unknown as never);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('getAllMaps() should return hydrated maps (walkable + occupied)', async () => {
        const doc = makeDoc({
            _id: 'id-1',
            name: 'Map',
            description: 'desc',
            mode: GameMode.CLASSIC,
            size: MapSize.S,
            date: '2026-02-08T10:00:00.000Z',
            visibility: true,
            previewImage: 'AAA=',
            previewImageFormat: PreviewImageFormat.WEBP,
            map: [
                { position: { x: 0, y: 0 }, tileType: TileType.DIRT },
                { position: { x: 1, y: 0 }, tileType: TileType.WALL },
                { position: { x: 0, y: 1 }, tileType: TileType.DOOR, doorOpen: true },
                { position: { x: 1, y: 1 }, tileType: TileType.DOOR, doorOpen: false },
            ],
            objects: [
                makeObject({ id: 1, type: ObjectType.START, position: { x: 0, y: 0 }, size: ObjectSize.S }),
                makeObject({ id: 2, type: ObjectType.ARENA, position: { x: 0, y: 0 }, size: ObjectSize.L }),
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const query = makeQuery([doc]);
        mapModel.find.mockReturnValue(query);

        const [map] = await service.getAllMaps();

        expect(mapModel.find).toHaveBeenCalledWith();
        expect(query.sort).toHaveBeenCalledWith({ createdAt: 1 });
        expect(query.exec).toHaveBeenCalled();

        expect(map.id).toBe('id-1');
        expect(map.previewImage).toBe('AAA=');
        expect(map.previewImageFormat).toBe(PreviewImageFormat.WEBP);
        const sampleCell = map.map.find((c) => c.position.x === 0 && c.position.y === 0);
        expect(sampleCell).toBeDefined();
        expect(sampleCell).toHaveProperty('position');
        expect(sampleCell).toHaveProperty('tileType');
        expect(sampleCell).toHaveProperty('isWalkable');
        expect(sampleCell).toHaveProperty('isOccupied');
        expect(map.map.find((c) => c.position.x === 0 && c.position.y === 0)?.isOccupied).toBe(true);
        expect(map.map.find((c) => c.position.x === 1 && c.position.y === 0)?.isWalkable).toBe(false);
        expect(map.map.find((c) => c.position.x === 0 && c.position.y === 1)?.isWalkable).toBe(true);
        expect(map.map.find((c) => c.position.x === 1 && c.position.y === 1)?.isWalkable).toBe(false);
        expect((map as unknown as { createdAt?: Date }).createdAt).toBeUndefined();
        expect((map as unknown as { updatedAt?: Date }).updatedAt).toBeUndefined();
    });

    it('getVisibleMaps() should query only visible maps', async () => {
        const doc = makeDoc({
            _id: 'id-2',
            name: 'Visible map',
            description: 'desc',
            mode: GameMode.CLASSIC,
            size: MapSize.S,
            date: '2026-02-08T10:00:00.000Z',
            visibility: true,
            map: [],
            objects: [],
        });

        const query = makeQuery([doc]);
        mapModel.find.mockReturnValue(query);

        const maps = await service.getVisibleMaps();

        expect(mapModel.find).toHaveBeenCalledWith({ visibility: true });
        expect(query.sort).toHaveBeenCalledWith({ createdAt: 1 });
        expect(maps).toHaveLength(1);
        expect(maps[0].id).toBe('id-2');
    });

    it('getMapById() should throw when missing', async () => {
        mapModel.findById.mockReturnValue(makeQuery(null));

        await expect(service.getMapById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('getMapById() should return hydrated map when found', async () => {
        const doc = makeDoc({
            _id: 'id-found',
            name: 'Found',
            description: 'desc',
            mode: GameMode.CLASSIC,
            size: MapSize.S,
            date: '2026-02-08T10:00:00.000Z',
            visibility: true,
            map: [{ position: { x: 0, y: 0 }, tileType: TileType.DIRT }],
            objects: [makeObject({ position: { x: 0, y: 0 }, size: ObjectSize.S })],
        });
        mapModel.findById.mockReturnValue(makeQuery(doc));

        const map = await service.getMapById('id-found');

        expect(mapModel.findById).toHaveBeenCalledWith('id-found');
        expect(map.id).toBe('id-found');
    });
});
