import { MapController } from '@app/controllers/map/map.controller';
import { MapService } from '@app/services/map/map.service';
import { GameMode, MapSize } from '@common/maps/map.enums';
import type { EditorMap } from '@common/maps/map.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { SinonStubbedInstance, createStubInstance } from 'sinon';

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

    it('getAllMapsSummary() should return all map summaries', async () => {
        const sampleSummary = {
            id: sampleMap.id,
            name: sampleMap.name,
            description: sampleMap.description,
            mode: sampleMap.mode,
            size: sampleMap.size,
            date: sampleMap.date,
            visibility: sampleMap.visibility,
        };
        mapService.getAllMapsSummary.resolves([sampleSummary]);

        const summaries = await controller.getAllMapsSummary();

        expect(mapService.getAllMapsSummary.calledOnce).toBe(true);
        expect(summaries).toEqual([sampleSummary]);
    });

    it('getMapById() should return the requested map', async () => {
        mapService.getMapById.resolves(sampleMap);

        const map = await controller.getMapById(sampleMap.id);

        expect(mapService.getMapById.calledOnceWithExactly(sampleMap.id)).toBe(true);
        expect(map).toEqual(sampleMap);
    });

    it('getMapByIdForEditor() should return the requested map with editor fields', async () => {
        const editorMap = {
            id: sampleMap.id,
            name: sampleMap.name,
            description: sampleMap.description,
            mode: sampleMap.mode,
            mapsize: sampleMap.size,
            map: sampleMap.map,
            objects: sampleMap.objects,
        };
        mapService.getMapByIdForEditor.resolves(editorMap);

        const map = await controller.getMapByIdForEditor(sampleMap.id);

        expect(mapService.getMapByIdForEditor.calledOnceWithExactly(sampleMap.id)).toBe(true);
        expect(map).toEqual(editorMap);
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

    it('updateMapVisibility() should call service with correct arguments', async () => {
        const mapId = sampleMap.id;
        const payload = { visibility: false };

        mapService.updateMapVisibility.resolves(); // returns Promise<void>

        await controller.updateMapVisibility(mapId, payload);

        expect(mapService.updateMapVisibility.calledOnceWithExactly(mapId, payload.visibility)).toBe(true);
    });

    it('deleteMap() should forward id to service', async () => {
        mapService.deleteMap.resolves();

        await controller.deleteMap(sampleMap.id);

        expect(mapService.deleteMap.calledOnceWithExactly(sampleMap.id)).toBe(true);
    });
});
