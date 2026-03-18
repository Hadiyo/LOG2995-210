import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JoinGameCardComponent } from './join-game-card.component';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';

/**
 * Testing Strategy:
 * We first validate rendering by checking that session metadata (name, mode, size,
 * description, player count) is correctly displayed in the template.
 *
 * We then cover lock-state behavior: a locked session shows "Verrouillee" with the
 * card--locked CSS modifier, while an unlocked session shows "Ouverte" without it.
 *
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

  const makeSession = (overrides: Partial<GameSessionPreview> = {}): GameSessionPreview => ({
    id: 'session-1',
    name: 'Partie test',
    description: 'Une belle partie',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 2,
    maxPlayers: 4,
    isLocked: false,
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

  it('should display session name, mode, size, description and player count', () => {
    component.session = makeSession({
      name: 'Partie CTF',
      mode: GameMode.CTF,
      size: MapSize.M,
      description: 'Description test',
      nbOfPlayers: 1,
      maxPlayers: 3,
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.name')?.textContent).toContain('Partie CTF');
    expect(el.textContent).toContain('Mode: CTF');
    expect(el.textContent).toContain(`Taille: ${MapSize.M}`);
    expect(el.textContent).toContain('Description: Description test');
    expect(el.textContent).toContain('Joueurs: 1/3');
  });

  it('should show "Ouverte" chip and no card--locked class when session is unlocked', () => {
    component.session = makeSession({ isLocked: false });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const chip = el.querySelector('.chip') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('Ouverte');
    expect(el.querySelector('.card--locked')).toBeNull();
  });

  it('should show "Verrouillee" chip and card--locked class when session is locked', () => {
    component.session = makeSession({ isLocked: true });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const chip = el.querySelector('.chip') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('Verrouillee');
    expect(el.querySelector('.card--locked')).not.toBeNull();
  });

  it('should emit session id via onSelect() when session is not locked', () => {
    component.session = makeSession({ id: 'session-1', isLocked: false });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    component.onSelect();
    expect(selectSpy).toHaveBeenCalledOnceWith('session-1');
  });

  it('should NOT emit via onSelect() when session is locked', () => {
    component.session = makeSession({ isLocked: true });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    component.onSelect();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('should emit session id when the card is clicked and session is unlocked', () => {
    component.session = makeSession({ id: 'session-1', isLocked: false });
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
    component.session = makeSession({ previewImage: 'QUJDRA==', previewImageFormat: 'png' });
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
