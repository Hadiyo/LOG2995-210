import { NotFoundException } from '@nestjs/common';

import { MapService } from '@app/services/map/map.service';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { GameMode, MapSize, TileType } from '@common/enum';
import { makeDoc, makeEditorMap, makeMapModelMock, makeObject, makeQuery } from './map.service.spec-utils';

jest.mock('@app/validators/server-map-validation');

describe('MapService (update)', () => {
    const createNameUniquenessCheckerMock = createNameUniquenessChecker as jest.Mock;
    const validateMapOnServerMock = validateMapOnServer as jest.Mock;

    let mapModel: ReturnType<typeof makeMapModelMock>;
    let service: MapService;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-08T12:00:00.000Z'));

        createNameUniquenessCheckerMock.mockReturnValue(async () => true);
        validateMapOnServerMock.mockResolvedValue({ isValid: true, issues: [] });

        mapModel = makeMapModelMock();
        service = new MapService(mapModel as unknown as never);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('updateMap() should update when record exists', async () => {
        const updatedDoc = makeDoc({
            _id: 'id-1',
            name: 'Updated',
            description: 'desc',
            mode: GameMode.CLASSIC,
            size: MapSize.S,
            date: '2026-02-08T11:00:00.000Z',
            visibility: true,
            map: [{ position: { x: 0, y: 0 }, tileType: TileType.DIRT }],
            objects: [makeObject({ position: { x: 0, y: 0 } })],
        });

        mapModel.findByIdAndUpdate.mockReturnValue(makeQuery(updatedDoc));

        const updated = await service.updateMap('id-1', makeEditorMap({ name: 'Updated' }));

        expect(createNameUniquenessCheckerMock).toHaveBeenCalledWith(mapModel, { excludeId: 'id-1' });
        expect(mapModel.findByIdAndUpdate).toHaveBeenCalledWith('id-1', expect.any(Object), { new: true });
        expect(updated.name).toBe('Updated');
    });

    it('updateMap() should create when record does not exist', async () => {
        mapModel.findByIdAndUpdate.mockReturnValue(makeQuery(null));
        mapModel.create.mockImplementation(async (payload: unknown) =>
            makeDoc({
                _id: 'created-on-update',
                ...(payload as Record<string, unknown>),
            }),
        );

        const updated = await service.updateMap('missing', makeEditorMap({ name: 'New name' }));

        expect(mapModel.create).toHaveBeenCalledTimes(1);
        expect(updated.id).toBe('created-on-update');
    });

    it('updateMapVisibility() should throw when missing', async () => {
        mapModel.findByIdAndUpdate.mockReturnValue(makeQuery(null));

        await expect(service.updateMapVisibility('missing', true)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateMapVisibility() should update visibility when found', async () => {
        const initialVisibility = false;
        const nextVisibility = true;
        const doc = makeDoc({
            _id: 'id-vis',
            name: 'Map',
            description: 'desc',
            mode: GameMode.CLASSIC,
            size: MapSize.S,
            date: '2026-02-08T10:00:00.000Z',
            visibility: nextVisibility,
            map: [],
            objects: [],
        });
        mapModel.findByIdAndUpdate.mockReturnValue(makeQuery(doc));

        const updated = await service.updateMapVisibility('id-vis', nextVisibility);

        expect(mapModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'id-vis',
            { visibility: nextVisibility },
            { new: true },
        );
        expect(updated.id).toBe('id-vis');
        expect(updated.visibility).toBe(nextVisibility);
        expect(updated.visibility).not.toBe(initialVisibility);
    });
});

