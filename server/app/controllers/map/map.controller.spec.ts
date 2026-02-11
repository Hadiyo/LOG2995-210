import { Test, TestingModule } from '@nestjs/testing';
import { SinonStubbedInstance, createStubInstance } from 'sinon';

import { MapController } from '@app/controllers/map/map.controller';
import { MapService } from '@app/services/map/map.service';
import { GameMode, MapSize } from '@common/enum';
import type { EditorMap } from '@common/interface';

const SAMPLE_DATE_ISO = '2026-02-08T12:00:00.000Z';

describe('MapController', () => {
    let controller: MapController;
    let mapService: SinonStubbedInstance<MapService>;

    const sampleMap: EditorMap = {
        id: 'map-1',
        name: 'Map 1',
        description: 'desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: SAMPLE_DATE_ISO,
        map: [],
        objects: [],
        visibility: true,
    };

    beforeEach(async () => {
        mapService = createStubInstance(MapService);
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MapController],
            providers: [
                {
                    provide: MapService,
                    useValue: mapService,
                },
            ],
        }).compile();

        controller = module.get<MapController>(MapController);
    });

    it('getAllMaps() should return all maps', async () => {
        mapService.getAllMaps.resolves([sampleMap]);

        const maps = await controller.getAllMaps();

        expect(mapService.getAllMaps.calledOnce).toBe(true);
        expect(maps).toEqual([sampleMap]);
    });

    it('getVisibleMaps() should return visible maps', async () => {
        mapService.getVisibleMaps.resolves([sampleMap]);

        const maps = await controller.getVisibleMaps();

        expect(mapService.getVisibleMaps.calledOnce).toBe(true);
        expect(maps).toEqual([sampleMap]);
    });

    it('getMapById() should return the requested map', async () => {
        mapService.getMapById.resolves(sampleMap);

        const map = await controller.getMapById(sampleMap.id);

        expect(mapService.getMapById.calledOnceWithExactly(sampleMap.id)).toBe(true);
        expect(map).toEqual(sampleMap);
    });

    it('createMap() should forward payload to service', async () => {
        mapService.createMap.resolves(sampleMap);

        const created = await controller.createMap(sampleMap);

        expect(mapService.createMap.calledOnceWithExactly(sampleMap)).toBe(true);
        expect(created).toEqual(sampleMap);
    });

    it('updateMap() should forward id and payload to service', async () => {
        mapService.updateMap.resolves(sampleMap);

        const updated = await controller.updateMap(sampleMap.id, sampleMap);

        expect(mapService.updateMap.calledOnceWithExactly(sampleMap.id, sampleMap)).toBe(true);
        expect(updated).toEqual(sampleMap);
    });

    it('updateMapVisibility() should forward visibility to service', async () => {
        mapService.updateMapVisibility.resolves(sampleMap);

        const updated = await controller.updateMapVisibility(sampleMap.id, { visibility: false });

        expect(mapService.updateMapVisibility.calledOnceWithExactly(sampleMap.id, false)).toBe(true);
        expect(updated).toEqual(sampleMap);
    });

    it('deleteMap() should forward id to service', async () => {
        mapService.deleteMap.resolves();

        await controller.deleteMap(sampleMap.id);

        expect(mapService.deleteMap.calledOnceWithExactly(sampleMap.id)).toBe(true);
    });
});
