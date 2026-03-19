import { TestBed } from '@angular/core/testing';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { BEFORE_UNLOAD } from '@common/socket-events';
import { Socket } from 'socket.io-client';


describe('SocketManagerService', () => {
  let service: SocketManagerService;
  let mockSocket: jasmine.SpyObj<Socket>;

  beforeEach(() => {
    mockSocket = jasmine.createSpyObj<Socket>('Socket', [
      'on',
      'off',
      'emit',
      'disconnect',
      'connect',
    ], {
      connected: true,
    });

    TestBed.configureTestingModule({});

    service = TestBed.inject(SocketManagerService);
    service['socket'] = mockSocket;

  });

  it('should set up a window event listener', () => {
    spyOn(window, 'addEventListener');
    service['subscribeToWindowEvent']();
    expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
  });

  it('should call socket.disconnect when BEFORE_UNLOAD fires', () => {
    const addListenerSpy = spyOn(window, 'addEventListener').and.callThrough();
    service['subscribeToWindowEvent']();
    const callback = addListenerSpy.calls.mostRecent().args[1] as EventListener;
    callback(new Event(BEFORE_UNLOAD));
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
