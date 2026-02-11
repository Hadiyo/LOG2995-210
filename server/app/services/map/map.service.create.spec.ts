import { BadRequestException } from '@nestjs/common';

import { MapService } from '@app/services/map/map.service';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { PreviewImageFormat } from '@common/interface';
import { MAX_PREVIEW_IMAGE_BASE64_LENGTH } from '@common/constants';
import { TileType } from '@common/enum';
import { makeCell, makeDoc, makeEditorMap, makeMapModelMock, makeObject } from './map.service.spec-utils';

jest.mock('@app/validators/server-map-validation');

const FIXED_NOW_ISO = '2026-02-08T12:00:00.000Z';

describe('MapService (create)', () => {
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

    it('createMap() should validate then insert sanitized payload', async () => {
        const input = makeEditorMap({
            name: '  My name  ',
            description: '  My desc  ',
            visibility: false,
            previewImage: 'QUJDRA==',
            previewImageFormat: PreviewImageFormat.WEBP,
            map: [
                makeCell({ position: { x: 0, y: 0 }, tileType: TileType.DIRT }),
                makeCell({ position: { x: 1, y: 0 }, tileType: TileType.DOOR, isWalkable: true }),
                makeCell({ position: { x: 2, y: 0 }, tileType: TileType.DOOR, isWalkable: false }),
            ],
            objects: [makeObject({ id: 1, position: { x: 0, y: 0 } })],
        });

        mapModel.create.mockImplementation(async (createPayload: unknown) =>
            makeDoc({
                _id: 'new-id',
                ...(createPayload as Record<string, unknown>),
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        );

        const created = await service.createMap(input);

        expect(createNameUniquenessCheckerMock).toHaveBeenCalledWith(mapModel, { excludeId: undefined });
        expect(validateMapOnServerMock).toHaveBeenCalled();
        expect(mapModel.create).toHaveBeenCalledTimes(1);

        const createdPayload = mapModel.create.mock.calls[0][0] as Record<string, unknown>;
        expect(createdPayload.name).toBe('My name');
        expect(createdPayload.description).toBe('My desc');
        expect(createdPayload.visibility).toBe(false);
        expect(createdPayload.date).toBe(FIXED_NOW_ISO);
        expect((createdPayload.map as Record<string, unknown>[])[0]).not.toHaveProperty('doorOpen');
        expect((createdPayload.map as Record<string, unknown>[])[1]).toEqual({
            position: { x: 1, y: 0 },
            tileType: TileType.DOOR,
            doorOpen: true,
        });
        expect((createdPayload.map as Record<string, unknown>[])[2]).toEqual({
            position: { x: 2, y: 0 },
            tileType: TileType.DOOR,
            doorOpen: false,
        });

        expect(created.id).toBe('new-id');
        expect(created.previewImage).toBe('QUJDRA==');
        expect(created.previewImageFormat).toBe(PreviewImageFormat.WEBP);
    });

    it('createMap() should reject invalid maps with a BadRequestException', async () => {
        validateMapOnServerMock.mockResolvedValueOnce({
            isValid: false,
            issues: [{ code: 'NAME_REQUIRED', message: 'Le nom de la carte est requis.' }],
        });

        await expect(service.createMap(makeEditorMap())).rejects.toBeInstanceOf(BadRequestException);
    });

    it('createMap() should strip invalid preview format but keep valid preview data', async () => {
        const invalidPreviewImageFormat = 'jpeg' as unknown as PreviewImageFormat;
        const input = makeEditorMap({
            previewImage: 'QUJDRA==',
            previewImageFormat: invalidPreviewImageFormat,
        });

        mapModel.create.mockImplementation(async (createPayload: unknown) =>
            makeDoc({
                _id: 'id-preview',
                ...(createPayload as Record<string, unknown>),
            }),
        );

        await service.createMap(input);

        const payload = mapModel.create.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.previewImage).toBe('QUJDRA==');
        expect(payload.previewImageFormat).toBeUndefined();
    });

    it('createMap() should drop invalid preview data (non-base64 / too long)', async () => {
        const tooLong = 'A'.repeat(MAX_PREVIEW_IMAGE_BASE64_LENGTH + 1);
        const input = makeEditorMap({
            previewImage: tooLong,
            previewImageFormat: PreviewImageFormat.PNG,
        });

        mapModel.create.mockImplementation(async (createPayload: unknown) =>
            makeDoc({
                _id: 'id-preview',
                ...(createPayload as Record<string, unknown>),
            }),
        );

        await service.createMap(input);

        const payload = mapModel.create.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.previewImage).toBeUndefined();
        expect(payload.previewImageFormat).toBeUndefined();
    });

    it('createMap() should drop invalid preview data (not a base64 string)', async () => {
        const input = makeEditorMap({
            previewImage: 'not-base64-',
            previewImageFormat: PreviewImageFormat.WEBP,
        });

        mapModel.create.mockImplementation(async (createPayload: unknown) =>
            makeDoc({
                _id: 'id-preview',
                ...(createPayload as Record<string, unknown>),
            }),
        );

        await service.createMap(input);

        const payload = mapModel.create.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.previewImage).toBeUndefined();
        expect(payload.previewImageFormat).toBeUndefined();
    });

    it('createMap() should drop preview when missing', async () => {
        const input = makeEditorMap({
            previewImage: undefined,
            previewImageFormat: PreviewImageFormat.WEBP,
        });

        mapModel.create.mockImplementation(async (createPayload: unknown) =>
            makeDoc({
                _id: 'id-preview',
                ...(createPayload as Record<string, unknown>),
            }),
        );

        await service.createMap(input);

        const payload = mapModel.create.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.previewImage).toBeUndefined();
        expect(payload.previewImageFormat).toBeUndefined();
    });
});
