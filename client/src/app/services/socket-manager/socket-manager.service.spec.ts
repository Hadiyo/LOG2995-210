import { TestBed } from '@angular/core/testing';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';

describe('SocketManagerService', () => {
  let service: SocketManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
