import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreviewImageFormat } from '@common/enum';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { JoinGameCardComponent } from './join-game-card.component';

/**
 * Testing Strategy:
 * We verify interaction logic: onSelect() emits the session id when the session is
 * unlocked, and emits nothing when it is locked. We also confirm this via a click
 * on the card element.
 *
 * Finally, we verify thumbnail rendering: an <img> is shown when previewImage is set
 * and a placeholder is shown otherwise.
 */
describe('JoinGameCardComponent', () => {
  let component: JoinGameCardComponent;
  let fixture: ComponentFixture<JoinGameCardComponent>;

  const makeSession = (overrides: Partial<WaitingRoomPreview> = {}): WaitingRoomPreview => ({
    accessCode: 'session-1',
    mapId: 'hello',
    name: 'Partie test',
    description: 'Une belle partie',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    playerCount: 2,
    maxPlayers: 4,
    isLocked: false,
    previewImage: 'QUJDRA==',
    previewImageFormat: PreviewImageFormat.PNG,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinGameCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinGameCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.session = makeSession();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should emit session id via onSelect() when session is not locked', () => {
    component.session = makeSession({ accessCode: 'session-1', isLocked: false });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    component.onSelect();
    expect(selectSpy).toHaveBeenCalledOnceWith('session-1');
  });

  it('should NOT emit via onSelect() when session is locked', () => {
    const selectSpy = spyOn(component.select, 'emit');
    component.session = makeSession({ playerCount: 4, maxPlayers: 4 });
    fixture.detectChanges();
    component.onSelect();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('should emit session id when the card is clicked and session is unlocked', () => {
    component.session = makeSession({ accessCode: 'session-1', isLocked: false });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    const card = fixture.nativeElement.querySelector('article.card') as HTMLElement;
    card.click();
    expect(selectSpy).toHaveBeenCalledOnceWith('session-1');
  });

  it('should show placeholder when previewImage is not set', () => {
    component.session = makeSession({ previewImage: undefined });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.thumbnail-placeholder')).not.toBeNull();
    expect(el.querySelector('img.thumbnail-img')).toBeNull();
  });

  it('should show an image with correct src when previewImage is set', () => {
    component.session = makeSession({ previewImage: 'QUJDRA==', previewImageFormat: PreviewImageFormat.PNG });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const img = el.querySelector('img.thumbnail-img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,QUJDRA==');
    expect(img.getAttribute('alt')).toContain('Partie test');
  });

  it('should default to webp format when previewImageFormat is not set', () => {
    component.session = makeSession({ previewImage: 'QUJDRA==', previewImageFormat: undefined });
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img.thumbnail-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/webp;base64,QUJDRA==');
  });
});
