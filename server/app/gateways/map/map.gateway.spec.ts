import { MapGateway } from '@app/gateways/map/map.gateway';
import { MapService } from '@app/services/map/map.service';
import { Test, TestingModule } from '@nestjs/testing';

describe('MapGateway', () => {
  let gateway: MapGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapGateway,
        {
          provide: MapService,
          useValue: {
            on: jest.fn(),
            off: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<MapGateway>(MapGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
