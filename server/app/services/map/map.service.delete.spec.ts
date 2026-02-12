import { NotFoundException } from '@nestjs/common';

import { MapService } from '@app/services/map/map.service';
import { createNameUniquenessChecker, validateMapOnServer } from '@app/validators/server-map-validation';
import { makeMapModelMock, makeQuery } from './map.service.spec-utils';

/**
 * Testing Strategy:
 * - Verify the normal deletion flow by ensuring the service
 * successfully resolves when a document is removed.
 * 
 * - Then we test the edge case where no document is deleted
 * (deletedCount = 0) to confirm that a NotFoundException is thrown.
 */

jest.mock('@app/validators/server-map-validation');

describe('MapService (delete)', () => {
    const createNameUniquenessCheckerMock = createNameUniquenessChecker as jest.Mock;
    const validateMapOnServerMock = validateMapOnServer as jest.Mock;

    let mapModel: ReturnType<typeof makeMapModelMock>;
    let service: MapService;

    beforeEach(() => {
        createNameUniquenessCheckerMock.mockReturnValue(async () => true);
        validateMapOnServerMock.mockResolvedValue({ isValid: true, issues: [] });

        mapModel = makeMapModelMock();
        service = new MapService(mapModel as unknown as never);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('deleteMap() should resolve when a map is deleted', async () => {
        mapModel.deleteOne.mockReturnValue(makeQuery({ deletedCount: 1 }));

        await expect(service.deleteMap('id-1')).resolves.toBeUndefined();
        expect(mapModel.deleteOne).toHaveBeenCalledWith({ _id: 'id-1' });
    });

    it('deleteMap() should throw when already deleted', async () => {
        mapModel.deleteOne.mockReturnValue(makeQuery({ deletedCount: 0 }));

        await expect(service.deleteMap('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
});

