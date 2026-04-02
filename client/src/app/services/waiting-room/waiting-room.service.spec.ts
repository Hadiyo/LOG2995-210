import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SocketManagerService } from '@app/services/socket-manager/socket-manager.service';
import { MatchLobbyPlayer } from '@common/game/match.interface';
import { WaitingRoomEvents } from '@common/socket-events';
import { WaitingRoomService } from './waiting-room.service';

describe('WaitingRoomService', () => {
  let service: WaitingRoomService;
  let socketManagerSpy: jasmine.SpyObj<SocketManagerService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    socketManagerSpy = jasmine.createSpyObj<SocketManagerService>('SocketManagerService', [
      'isSocketAlive',
      'connect',
      'send',
      'on',
      'off',
    ]);
    socketManagerSpy.isSocketAlive.and.returnValue(true);

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        WaitingRoomService,
        { provide: SocketManagerService, useValue: socketManagerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(WaitingRoomService);
  });

  it('should create the waiting room immediately for the organizer', () => {
    const player = createPlayer('organizer-1');

    service.initAsOrganizer('map-1', player);

    expect(socketManagerSpy.send).toHaveBeenCalledWith(WaitingRoomEvents.CreateWaitingRoom, {
      mapId: 'map-1',
      player: jasmine.objectContaining({
        id: player.id,
        name: player.name,
        isOrganizer: true,
      }),
    });
  });

  it('should join the waiting room immediately for a player without replaying on view init', () => {
    const player = createPlayer('player-1');

    service.initAsPlayer('ABCD', player);
    service.initWaitingRoom();

    expect(socketManagerSpy.send).toHaveBeenCalledTimes(1);
    expect(socketManagerSpy.send).toHaveBeenCalledWith(WaitingRoomEvents.JoinWaitingRoom, {
      accessCode: 'ABCD',
      player: jasmine.objectContaining({
        id: player.id,
        name: player.name,
        isOrganizer: false,
      }),
    });
  });
});

function createPlayer(id: string): MatchLobbyPlayer {
  return {
    id,
    name: `Player ${id}`,
    avatarId: 0,
    isOrganizer: false,
    speed: 6,
    maxHealth: 4,
    baseAttack: 4,
    baseDefense: 4,
    attackDie: 'D6',
    defenseDie: 'D4',
    controller: 'human',
  };
}
