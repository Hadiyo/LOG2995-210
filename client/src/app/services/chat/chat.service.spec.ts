import { TestBed } from '@angular/core/testing';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';

import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let socketManagerSpy: jasmine.SpyObj<SocketManagerService>;

  beforeEach(() => {
    socketManagerSpy = jasmine.createSpyObj<SocketManagerService>('SocketManagerService', [
      'isSocketAlive',
      'connect',
      'send',
      'on',
      'off',
    ]);
    socketManagerSpy.isSocketAlive.and.returnValue(true);

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: SocketManagerService, useValue: socketManagerSpy },
      ],
    });
    service = TestBed.inject(ChatService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
