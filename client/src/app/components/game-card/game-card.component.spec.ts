import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { PreviewImageFormat } from '@common/enum';
import { GameMode, MapSize, ObjectSize, ObjectType } from '@common/maps/map.enums';
import { type EditorMap } from '@common/maps/map.interface';

/**
 * Testing Strategy:
 * We validate normal rendering first by checking displayed map metadata
 * (name, size, mode, date, and description tooltip) and thumbnail behavior.
 *
 * We then cover edge cases such as missing thumbnail, missing date,
 * and unknown mode values to ensure safe fallbacks in the UI.
 *
 * Finally, we verify user interactions by asserting emitted events
 * (select, edit, remove, toggle visibility) so parent flows receive
 * the correct map payload and remain stable.
 */
describe('GameCardComponent', () => {
  let component: GameCardComponent;
  let fixture: ComponentFixture<GameCardComponent>;

  const SAMPLE_DATE_ISO = '2026-02-08T12:00:00.000Z';

  const makeMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
    id: 'id-1',
    name: 'My map',
    description: 'My description',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: SAMPLE_DATE_ISO,
    map: [],
    objects: [{ id: 1, type: ObjectType.START, position: { x: 0, y: 0 }, size: ObjectSize.S }],
    visibility: true,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameCardComponent);
    component = fixture.componentInstance;
  });

  it('should display name/size/mode/date and set description tooltip', () => {
    component.map = makeMap({ mode: GameMode.CTF });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const card = el.querySelector('article.card') as HTMLElement;
    expect(card.getAttribute('title')).toBe('My description');

    expect(el.querySelector('.name')?.textContent).toContain('My map');
    expect(el.textContent).toContain('Taille:');
    expect(el.textContent).toContain('10');
    expect(el.textContent).toContain('Mode:');
    expect(el.textContent).toContain('CTF');

    const time = el.querySelector('time') as HTMLTimeElement;
    expect(time.getAttribute('datetime')).toBe(SAMPLE_DATE_ISO);
    expect(time.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('should show a placeholder when thumbnailUrl is missing', () => {
    component.map = makeMap();
    component.thumbnailUrl = undefined;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.thumbnail-placeholder')?.textContent).toContain('Apercu indisponible');
    expect(el.querySelector('img.thumbnail-img')).toBeNull();
  });

  it('should render thumbnail using previewImageFormat (defaults to webp)', () => {
    component.map = makeMap({ previewImageFormat: PreviewImageFormat.PNG });
    component.thumbnailUrl = 'QUJDRA==';
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const img = el.querySelector('img.thumbnail-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/png;base64,QUJDRA==');
    expect(img.getAttribute('alt')).toBe('Apercu de My map');
  });

  it('should show an em dash when date is missing', () => {
    component.map = makeMap({ date: '' });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const time = el.querySelector('time') as HTMLTimeElement;
    expect(time.textContent?.trim()).toBe('\u2014');
  });

  it('modeLabel should fall back to the raw value when unknown', () => {
    component.map = makeMap({ mode: 'UNKNOWN' as unknown as GameMode });
    expect(component.modeLabel).toBe('UNKNOWN');
  });

  it('should emit edit/remove/toggleVisibility events', () => {
    const map = makeMap({ visibility: true });
    component.map = map;
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    const editSpy = jasmine.createSpy('edit');
    const removeSpy = jasmine.createSpy('remove');
    const toggleSpy = jasmine.createSpy('toggleVisibility');
    component.select.subscribe(selectSpy);
    component.edit.subscribe(editSpy);
    component.remove.subscribe(removeSpy);
    component.toggleVisibility.subscribe(toggleSpy);

    const el: HTMLElement = fixture.nativeElement;
    const card = el.querySelector('article.card') as HTMLElement;
    card.click();
    expect(selectSpy).toHaveBeenCalledOnceWith(map.id);

    const editBtn = el.querySelector('button[aria-label=\"Modifier\"]') as HTMLButtonElement;
    editBtn.click();
    expect(editSpy).toHaveBeenCalledOnceWith(map);

    const toggleBtn = el.querySelector('button[aria-label=\"Masquer\"]') as HTMLButtonElement;
    expect(toggleBtn.getAttribute('title')).toBe('Masquer');
    toggleBtn.click();
    expect(toggleSpy).toHaveBeenCalledOnceWith(map);

    const deleteBtn = el.querySelector('button[aria-label=\"Supprimer\"]') as HTMLButtonElement;
    deleteBtn.click();
    expect(removeSpy).toHaveBeenCalledOnceWith(map);
  });

  it('should emit select when clicking the card', () => {
    const map = makeMap();
    component.map = map;
    fixture.detectChanges();

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    const card = (fixture.nativeElement as HTMLElement).querySelector('article.card') as HTMLElement;
    card.click();

    expect(selectSpy).toHaveBeenCalledOnceWith(map.id);
  });
});
