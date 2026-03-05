import { TestBed } from '@angular/core/testing';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { Socket } from 'socket.io-client';

describe('SocketManagerService', () => {
  let service: SocketManagerService;
  let mockSocket: jasmine.SpyObj<Socket>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketManagerService);

    mockSocket = jasmine.createSpyObj<Socket>('Socket', ['disconnect']);

    // replace the private socket
    (service as unknown as { socket: Socket }).socket = mockSocket;
  });

  it('should set up a window event listener', () => {
    spyOn(window, 'addEventListener');

    service['subscribeToWindowEvent']();

    expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
  });

  it('should call socket.disconnect when BEFORE_UNLOAD fires', () => {
    service.subscribeToWindowEvent();
    window.dispatchEvent(new Event('beforeunload'));
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
