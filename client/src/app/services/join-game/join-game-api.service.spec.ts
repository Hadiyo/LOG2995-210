import { TestBed } from '@angular/core/testing';

import { JoinGameApiService } from './join-game-api.service';

describe('JoinGameApiService', () => {
  let service: JoinGameApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JoinGameApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
