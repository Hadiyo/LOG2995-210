import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { WaitingRoomDirectoryService } from '@app/services/waiting-room/waiting-room-directory.service';
import { JoinGameComponent } from './join-game.component';

describe('JoinGameComponent', () => {
  let component: JoinGameComponent;
  let fixture: ComponentFixture<JoinGameComponent>;
  let mockWaitingRoomDirectory: jasmine.SpyObj<WaitingRoomDirectoryService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockWaitingRoomDirectory = jasmine.createSpyObj(
      'WaitingRoomDirectoryService',
      ['init', 'destroy'],
      {
        previews: signal([]),
        errorMessage: signal(null),
        state: signal<'idle' | 'loading' | 'loaded' | 'error'>('idle'),
      },
    );

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [JoinGameComponent],
      providers: [
        { provide: WaitingRoomDirectoryService, useValue: mockWaitingRoomDirectory },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinGameComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call init on ngOnInit', () => {
    component.ngOnInit();
    expect(mockWaitingRoomDirectory.init).toHaveBeenCalled();
  });

  it('should call destroy on ngOnDestroy', () => {
    component.ngOnDestroy();
    expect(mockWaitingRoomDirectory.destroy).toHaveBeenCalled();
  });

  it('should navigate to character creation with accessCode when session is selected', async () => {
    const accessCode = 'ABC123';

    await component.onSelectedSession(accessCode);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/character-creation'],
      { queryParams: { accessCode } },
    );
  });

  it('should compute isLoading correctly when state is loading', () => {
    mockWaitingRoomDirectory.state.set('loading');

    expect(component['isLoading']()).toBeTrue();
  });

  it('should compute isLoading correctly when state is not loading', () => {
    mockWaitingRoomDirectory.state.set('idle');

    expect(component['isLoading']()).toBeFalse();
  });
});