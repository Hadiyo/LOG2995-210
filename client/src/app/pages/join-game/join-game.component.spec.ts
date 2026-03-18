import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { MatSnackBar } from '@angular/material/snack-bar';
import { ServiceState } from '@app/services/service-state.enum';
import { SessionService } from '@app/services/session/session.service';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { JoinGameComponent } from './join-game.component';

/**
 * Testing Strategy:
 * We first verify that the component is created successfully with mocked dependencies.
 *
 * We then validate lifecycle hooks: ngOnInit() delegates to initGameSessionService(),
 * and ngOnDestroy() delegates to unsubscribeToSessionEvents().
 *
 * We confirm that onSelectedSession() sets the preview id, the context to 'join',
 * and navigates to '/character-creation'. 
 * 
 * We confirm that when the client navigates to the character-creation page, it sends
 * a request to join the session and if the navigation fails an error message opens.
 *
 * We verify the template reacts to the service state: a loading spinner message appears
 * when state is Loading, an empty-state message when the session list is empty, and
 * one <app-join-game-card> per available session otherwise.
 */
describe('JoinGameComponent', () => {
  let component: JoinGameComponent;
  let fixture: ComponentFixture<JoinGameComponent>;
  let router: Router;
  let sessionsSubject: BehaviorSubject<GameSessionPreview[]>;
  let stateSignal: ReturnType<typeof signal<ServiceState>>;
  let mockSessionService: jasmine.SpyObj<SessionService>;

  const makeSession = (overrides: Partial<GameSessionPreview> = {}): GameSessionPreview => ({
    id: 'session-1',
    name: 'Partie test',
    description: 'Desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 1,
    maxPlayers: 4,
    isLocked: false,
    ...overrides,
  });

  beforeEach(async () => {
    stateSignal = signal<ServiceState>(ServiceState.Idle);
    sessionsSubject = new BehaviorSubject<GameSessionPreview[]>([]);

    mockSessionService = jasmine.createSpyObj<SessionService>('SessionService', [
      'initGameSessionService',
      'unsubscribeToSessionEvents',
      'setPreviewId',
      'setContext',
      'joinSession',
    ]);
    Object.assign(mockSessionService, {
      state: stateSignal,
      sessionsPreview$: sessionsSubject.asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [JoinGameComponent],
      providers: [
        MatSnackBar,
        { provide: SessionService, useValue: mockSessionService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinGameComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('ngOnInit should call initGameSessionService()', () => {
    fixture.detectChanges();
    expect(mockSessionService.initGameSessionService).toHaveBeenCalledTimes(1);
  });

  it('ngOnDestroy should call unsubscribeToSessionEvents()', () => {
    fixture.detectChanges();
    fixture.destroy();
    expect(mockSessionService.unsubscribeToSessionEvents).toHaveBeenCalledTimes(1);
  });

  it('should call joinSession if navigation succeeds', async () => {
      const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

      await component['onSelectedSession']('session-42');

      expect(mockSessionService.setPreviewId).toHaveBeenCalledOnceWith('session-42');
      expect(mockSessionService.setContext).toHaveBeenCalledOnceWith('join');
      expect(navigateSpy).toHaveBeenCalledOnceWith(['/character-creation']);
      expect(mockSessionService.joinSession).toHaveBeenCalledOnceWith('session-42');
  });

  it('should show snackbar if navigation fails', async () => {
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(false));
    const spy = spyOn(component['snackBar'], 'open');

    await component['onSelectedSession']('session-42');

    expect(mockSessionService.setPreviewId).toHaveBeenCalledOnceWith('session-42');
    expect(mockSessionService.setContext).toHaveBeenCalledOnceWith('join');
    expect(mockSessionService.joinSession).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledOnceWith(
      'Impossible de naviguer vers la création de personnage',
      'Fermer',
      { duration: 3000, panelClass: ['error-snackbar'] },
    );
  });

  it('should show loading message when service state is Loading', () => {
    stateSignal.set(ServiceState.Loading);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Chargement des parties...');
  });

  it('should show empty-state message when sessions list is empty and not loading', () => {
    stateSignal.set(ServiceState.Loaded);
    sessionsSubject.next([]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain("Aucune partie n'est disponible.");
  });

  it('should render one app-join-game-card per available session', () => {
    stateSignal.set(ServiceState.Loaded);
    sessionsSubject.next([makeSession({ id: 's1' }), makeSession({ id: 's2' })]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('app-join-game-card');
    expect(cards.length).toBe(2);
  });
});
