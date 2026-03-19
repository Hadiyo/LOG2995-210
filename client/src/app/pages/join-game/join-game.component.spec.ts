import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { WaitingRoomDirectoryService } from '@app/services/waiting-room/waiting-room-directory.service';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { JoinGameComponent } from './join-game.component';

describe('JoinGameComponent', () => {
  let component: JoinGameComponent;
  let fixture: ComponentFixture<JoinGameComponent>;
  let router: Router;
  let mockDirectoryService: jasmine.SpyObj<WaitingRoomDirectoryService> & {
    previews: ReturnType<typeof signal<WaitingRoomPreview[]>>;
    state: ReturnType<typeof signal<'idle' | 'loading' | 'loaded' | 'error'>>;
    errorMessage: ReturnType<typeof signal<string>>;
  };

  const makePreview = (overrides: Partial<WaitingRoomPreview> = {}): WaitingRoomPreview => ({
    accessCode: 'ABCD',
    mapId: 'map-1',
    name: 'Partie test',
    description: 'Desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    playerCount: 1,
    maxPlayers: 4,
    ...overrides,
  });

  beforeEach(async () => {
    const directorySpy = jasmine.createSpyObj<WaitingRoomDirectoryService>('WaitingRoomDirectoryService', ['init', 'destroy']);
    mockDirectoryService = Object.assign(directorySpy, {
      previews: signal<WaitingRoomPreview[]>([]),
      state: signal<'idle' | 'loading' | 'loaded' | 'error'>('idle'),
      errorMessage: signal(''),
    });

    await TestBed.configureTestingModule({
      imports: [JoinGameComponent],
      providers: [
        { provide: WaitingRoomDirectoryService, useValue: mockDirectoryService },
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

  it('ngOnInit should call directory init()', () => {
    fixture.detectChanges();
    expect(mockDirectoryService.init).toHaveBeenCalledTimes(1);
  });

  it('ngOnDestroy should call directory destroy()', () => {
    fixture.detectChanges();
    fixture.destroy();
    expect(mockDirectoryService.destroy).toHaveBeenCalledTimes(1);
  });

  it('should navigate to character creation with accessCode query param', async () => {
    const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    await component.onSelectedSession('ROOM42');

    expect(navigateSpy).toHaveBeenCalledOnceWith(['/character-creation'], {
      queryParams: { accessCode: 'ROOM42' },
    });
  });

  it('should show loading message when directory state is loading', () => {
    mockDirectoryService.state.set('loading');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Chargement des parties...');
  });

  it('should show directory error when loading fails', () => {
    mockDirectoryService.state.set('error');
    mockDirectoryService.errorMessage.set('Impossible de charger les parties disponibles.');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Impossible de charger les parties disponibles.');
  });

  it('should show empty-state message when preview list is empty', () => {
    mockDirectoryService.state.set('loaded');
    mockDirectoryService.previews.set([]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain("Aucune partie n'est disponible.");
  });

  it('should render one app-join-game-card per available preview', () => {
    mockDirectoryService.state.set('loaded');
    mockDirectoryService.previews.set([
      makePreview({ accessCode: 'ABCD' }),
      makePreview({ accessCode: 'EFGH' }),
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('app-join-game-card');
    expect(cards.length).toBe(2);
  });
});
