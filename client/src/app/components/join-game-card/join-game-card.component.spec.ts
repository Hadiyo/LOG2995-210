import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JoinGameCardComponent } from './join-game-card.component';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';
import { PreviewImageFormat } from '@common/enum';
import { GameMode, MapSize } from '@common/maps/map.enums';

describe('JoinGameCardComponent', () => {
  let component: JoinGameCardComponent;
  let fixture: ComponentFixture<JoinGameCardComponent>;

  const makeSession = (overrides: Partial<WaitingRoomPreview> = {}): WaitingRoomPreview => ({
    accessCode: 'ABCD',
    mapId: 'map-1',
    name: 'Partie test',
    description: 'Une belle partie',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    playerCount: 2,
    maxPlayers: 4,
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
      mode: GameMode.CLASSIC,
      size: MapSize.M,
      description: 'Description test',
      playerCount: 1,
      maxPlayers: 3,
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.name')?.textContent).toContain('Partie CTF');
    expect(el.textContent).toContain(`Mode: ${GameMode.CLASSIC}`);
    expect(el.textContent).toContain(`Taille: ${MapSize.M}`);
    expect(el.textContent).toContain('Description: Description test');
    expect(el.textContent).toContain('Joueurs: 1/3');
    expect(el.textContent).toContain('Code: ABCD');
  });

  it('should show "Ouverte" chip and no card--locked class when session is unlocked', () => {
    component.session = makeSession({ playerCount: 1, maxPlayers: 4 });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const chip = el.querySelector('.chip') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('Ouverte');
    expect(el.querySelector('.card--locked')).toBeNull();
  });

  it('should show "Verrouillee" chip and card--locked class when session is full', () => {
    component.session = makeSession({ playerCount: 4, maxPlayers: 4 });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const chip = el.querySelector('.chip') as HTMLElement;
    expect(chip.textContent?.trim()).toBe('Verrouillee');
    expect(el.querySelector('.card--locked')).not.toBeNull();
  });

  it('should emit access code via onSelect() when session is open', () => {
    component.session = makeSession({ accessCode: 'ROOM42', playerCount: 1, maxPlayers: 4 });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    component.onSelect();
    expect(selectSpy).toHaveBeenCalledOnceWith('ROOM42');
  });

  it('should not emit via onSelect() when session is locked', () => {
    component.session = makeSession({ playerCount: 4, maxPlayers: 4 });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    component.onSelect();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('should emit access code when the card is clicked and session is open', () => {
    component.session = makeSession({ accessCode: 'ROOM42', playerCount: 1, maxPlayers: 4 });
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    const card = fixture.nativeElement.querySelector('article.card') as HTMLElement;
    card.click();
    expect(selectSpy).toHaveBeenCalledOnceWith('ROOM42');
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
