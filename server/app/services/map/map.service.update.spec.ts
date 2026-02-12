import { NotFoundException } from '@nestjs/common';

import { MapService } from '@app/services/map/map.service';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { GameMode, MapSize, TileType } from '@common/enum';
import { SocketEvents } from '@common/socket-events';
import { makeDoc, makeEditorMap, makeMapModelMock, makeObject, makeQuery } from './map.service.spec-utils';

/**
 * Testing Strategy:
 * - Existing maps are properly updated with validation
 *   and name uniqueness checks.
 *
 * - A new map is created when updating a non-existing record.
 *
 * - Visibility updates correctly modify the record
 *   and emit the appropriate socket event.
 *
 * - NotFoundException is thrown when a visibility
 *   update targets a missing map.
 *
 * - Event subscription methods (on/off) correctly
 *   delegate to the internal event emitter.
 */

jest.mock('@app/validators/server-map-validation');

const FIXED_NOW_ISO = '2026-02-08T12:00:00.000Z';

describe('MapService (update)', () => {
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

    it('on() should register callback with mapEventEmitter', () => {
        const callback = jest.fn();
        const emitterSpy = jest.spyOn(service['mapEventEmitter'], 'on');

        service.on(SocketEvents.MapCreated, callback);

        expect(emitterSpy).toHaveBeenCalledWith(SocketEvents.MapCreated, callback);
    });

    it('off() should unregister callback from mapEventEmitter', () => {
        const callback = jest.fn();
        const emitterSpy = jest.spyOn(service['mapEventEmitter'], 'off');

        service.off(SocketEvents.MapCreated, callback);

        expect(emitterSpy).toHaveBeenCalledWith(SocketEvents.MapCreated, callback);
    });

    it.each([true, false])('updateMapVisibility() should update visibility when found (%s)', async (nextVisibility) => {
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
        const emitSpy = jest.spyOn(service['mapEventEmitter'], 'emit');

        await service.updateMapVisibility('id-vis', nextVisibility);

        expect(mapModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'id-vis',
            { visibility: nextVisibility },
            { new: true },
        );

        // Check that the event was emitted correctly
        expect(emitSpy).toHaveBeenCalledWith(SocketEvents.ToogleMapVisibility, {
            id: 'id-vis',
            isVisible: nextVisibility,
        });
    });
});