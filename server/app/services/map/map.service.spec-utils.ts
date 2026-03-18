import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import type { EditorCell, EditorMap, MapObject } from '@common/maps/map.interface';

export type QueryLike<T> = { sort: jest.Mock; exec: jest.Mock<Promise<T>> };

export type DocLike = { toObject: jest.Mock };

export type MapModelMock = {
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
    create: jest.Mock;
};

export const makeQuery = <T>(result: T): QueryLike<T> => ({
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
});

export const makeDoc = (record: Record<string, unknown>): DocLike => ({
    toObject: jest.fn().mockReturnValue(record),
});

export const makeMapModelMock = (): MapModelMock => ({
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
});

export const makeEditorMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
    id: '',
    name: ' My Map ',
    description: ' Desc ',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: 'ignored-by-server',
    visibility: true,
    map: [],
    objects: [],
    ...overrides,
});

export const makeCell = (overrides: Partial<EditorCell> = {}): EditorCell => ({
    position: { x: 0, y: 0 },
    tileType: TileType.DIRT,
    isWalkable: true,
    isOccupied: false,
    ...overrides,
});

export const makeObject = (overrides: Partial<MapObject> = {}): MapObject => ({
    id: 1,
    type: ObjectType.START,
    position: { x: 0, y: 0 },
    size: ObjectSize.S,
    ...overrides,
});
