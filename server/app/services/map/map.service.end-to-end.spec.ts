import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Connection, Model } from 'mongoose';

import { MapService } from '@app/services/map/map.service';
import { Map, type MapDocument, mapSchema } from '@app/model/database/map';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapObject } from '@common/interface';

type MapModule = {
    module: TestingModule;
    service: MapService;
    mapModel: Model<MapDocument>;
};

const buildMapModule = async (mongoUri: string): Promise<MapModule> => {
    const module = await Test.createTestingModule({
        imports: [
            MongooseModule.forRootAsync({
                useFactory: () => ({ uri: mongoUri }),
            }),
            MongooseModule.forFeature([{ name: Map.name, schema: mapSchema }]),
        ],
        providers: [MapService],
    }).compile();

    return {
        module,
        service: module.get<MapService>(MapService),
        mapModel: module.get<Model<MapDocument>>(getModelToken(Map.name)),
    };
};

const closeModule = async (mapModule: MapModule): Promise<void> => {
    const connection = mapModule.module.get<Connection>(getConnectionToken());
    await connection.close();
    await mapModule.module.close();
};

describe('MapServiceEndToEnd (persistence + ordering)', () => {
    let mongoServer: MongoMemoryServer;

    const makeCell = (x: number, y: number): EditorCell => ({
        position: { x, y },
        tileType: TileType.DIRT,
        isWalkable: true,
        isOccupied: false,
    });

    const makeStart = (id: number, x: number, y: number): MapObject => ({
        id,
        type: ObjectType.START,
        position: { x, y },
        size: ObjectSize.S,
    });

    const makeValidMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
        id: '',
        name: 'Map',
        description: 'Desc',
        mode: GameMode.CLASSIC,
        size: MapSize.S,
        date: '',
        visibility: false,
        map: [makeCell(0, 0), makeCell(1, 0)],
        objects: [makeStart(1, 0, 0), makeStart(2, 1, 0)],
        ...overrides,
    });

    const pause = async (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
    });

    afterAll(async () => {
        await mongoServer.stop({ doCleanup: true });
    });

    it('should persist a saved map after a full server restart (new module + new connection)', async () => {
        let first: MapModule | null = null;
        let second: MapModule | null = null;

        try {
            first = await buildMapModule(mongoServer.getUri());

            const created = await first.service.createMap(
                makeValidMap({ name: '  Persisted  ', description: '  Description  ' }),
            );

            const savedId = created.id;
            await closeModule(first);
            first = null;

            second = await buildMapModule(mongoServer.getUri());
            const loaded = await second.service.getMapById(savedId);

            expect(loaded.id).toBe(savedId);
            expect(loaded.name).toBe('Persisted');
            expect(loaded.description).toBe('Description');
            expect(loaded.visibility).toBe(false);
        } finally {
            if (second) {
                await second.mapModel.deleteMany({});
                await closeModule(second);
            }
            if (first) {
                await first.mapModel.deleteMany({});
                await closeModule(first);
            }
        }
    });

    it('should append newly created maps and preserve ordering when a map is modified', async () => {
        let mapModule: MapModule | null = null;

        try {
            mapModule = await buildMapModule(mongoServer.getUri());

            const first = await mapModule.service.createMap(makeValidMap({ name: 'First map' }));
            await pause();
            const second = await mapModule.service.createMap(makeValidMap({ name: 'Second map' }));

            const initialOrder = (await mapModule.service.getAllMaps()).map((map) => map.id);
            expect(initialOrder).toEqual([first.id, second.id]);

            await pause();
            await mapModule.service.updateMap(
                first.id,
                makeValidMap({ name: 'First map', description: 'Updated description' }),
            );

            const orderAfterUpdate = (await mapModule.service.getAllMaps()).map((map) => map.id);
            expect(orderAfterUpdate).toEqual([first.id, second.id]);

            await pause();
            const third = await mapModule.service.createMap(makeValidMap({ name: 'Third map' }));

            const orderAfterCreate = (await mapModule.service.getAllMaps()).map((map) => map.id);
            expect(orderAfterCreate).toEqual([first.id, second.id, third.id]);
        } finally {
            if (mapModule) {
                await mapModule.mapModel.deleteMany({});
                await closeModule(mapModule);
            }
        }
    });

    it('should remove a deleted map from the visible list', async () => {
        let mapModule: MapModule | null = null;

        try {
            mapModule = await buildMapModule(mongoServer.getUri());

            const created = await mapModule.service.createMap(makeValidMap({ name: 'Visible map' }));
            await mapModule.service.updateMapVisibility(created.id, true);

            const visibleBeforeDelete = await mapModule.service.getVisibleMaps();
            expect(visibleBeforeDelete.map((map) => map.id)).toContain(created.id);

            await mapModule.service.deleteMap(created.id);

            const visibleAfterDelete = await mapModule.service.getVisibleMaps();
            expect(visibleAfterDelete.map((map) => map.id)).not.toContain(created.id);
        } finally {
            if (mapModule) {
                await mapModule.mapModel.deleteMany({});
                await closeModule(mapModule);
            }
        }
    });
});
