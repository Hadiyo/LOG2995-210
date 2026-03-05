import { TestBed } from '@angular/core/testing';

import { SessionApiService } from '@app/services/session/session-api.service';

describe('SessionApiService', () => {
  let service: SessionApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
