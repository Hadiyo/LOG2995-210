import { Test, TestingModule } from '@nestjs/testing';
import { GameMapService } from './game-map.service';

describe('GameMapService', () => {
  let service: GameMapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameMapService],
    }).compile();

    service = module.get<GameMapService>(GameMapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
