import { Test, TestingModule } from '@nestjs/testing';
import { CombatGateway } from './combat.gateway';

describe('CombatGateway', () => {
  let gateway: CombatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CombatGateway],
    }).compile();

    gateway = module.get<CombatGateway>(CombatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
