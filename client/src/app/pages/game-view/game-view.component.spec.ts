import { Router, provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { GameViewComponent } from './game-view.component';

describe('GameViewComponent', () => {
  let component: GameViewComponent;
  let fixture: ComponentFixture<GameViewComponent>;
  let mockWaitingRoomService: jasmine.SpyObj<WaitingRoomService>;
  let router: Router;

  beforeEach(async () => {
    mockWaitingRoomService = jasmine.createSpyObj<WaitingRoomService>('WaitingRoomService', [
      'initWaitingRoom',
      'unsubscribeSocketEvents',
      'deleteGameSession',
      'leaveGameSession',
      'kickPlayer',
      'startGame',
      'sendMessage',
    ], {
      players$: of([]),
      messages$: of([]),
      isLocked$: of(false),
      maxPlayers$: of(4),
      statusMessage$: of(''),
      me: null,
    });

    await TestBed.configureTestingModule({
      imports: [GameViewComponent],
      providers: [
        { provide: WaitingRoomService, useValue: mockWaitingRoomService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameViewComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should init waiting room on mount', () => {
    expect(mockWaitingRoomService.initWaitingRoom).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe from socket events on destroy', () => {
    fixture.destroy();
    expect(mockWaitingRoomService.unsubscribeSocketEvents).toHaveBeenCalledTimes(1);
  });

  it('should let organizer delete the session when leaving', () => {
    Object.defineProperty(mockWaitingRoomService, 'me', {
      configurable: true,
      get: () => ({ id: 'p1', name: 'Host', avatarId: 0, isOrganizer: true, speed: 4, maxHealth: 4, baseAttack: 4, baseDefense: 4, attackDie: 'D4', defenseDie: 'D4', controller: 'human' }),
    });

    component['leaveSession']();

    expect(mockWaitingRoomService.deleteGameSession).toHaveBeenCalledTimes(1);
    expect(mockWaitingRoomService.leaveGameSession).not.toHaveBeenCalled();
  });

  it('should let participant leave and navigate home', async () => {
    Object.defineProperty(mockWaitingRoomService, 'me', {
      configurable: true,
      get: () => ({ id: 'p2', name: 'Player', avatarId: 1, isOrganizer: false, speed: 4, maxHealth: 4, baseAttack: 4, baseDefense: 4, attackDie: 'D4', defenseDie: 'D4', controller: 'human' }),
    });
    const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    component['leaveSession']();

    expect(mockWaitingRoomService.leaveGameSession).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledOnceWith(['/home']);
  });
});
