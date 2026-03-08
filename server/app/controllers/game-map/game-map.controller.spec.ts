import { GameMapService } from '@app/services/game-map/game-map.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GameMapController } from './game-map.controller';

describe('GameMapController', () => {
  let controller: GameMapController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameMapController],
      providers: [GameMapService],
    }).compile();

    controller = module.get<GameMapController>(GameMapController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
