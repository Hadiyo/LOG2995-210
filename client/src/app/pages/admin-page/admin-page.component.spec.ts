import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { CreateMapDialogComponent } from '@app/components/create-map-dialog/create-map-dialog.component';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AdminService } from '@app/services/admin.service';
import { MapService } from '@app/services/map.service';
import { GameMode, MapSize } from '@common/enum';
import type { EditorMap } from '@common/interface';

type AdminPageInternals = {
  closeDeleteDialog: () => void;
  confirmDeleteMap: () => void;
};

describe('AdminPageComponent', () => {
  let component: AdminPageComponent;
  let fixture: ComponentFixture<AdminPageComponent>;
  let mapServiceSpy: jasmine.SpyObj<MapService>;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;
  let router: Router;

  const makeMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
    id: 'id-1',
    name: 'Map 1',
    description: 'Desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: '2026-02-08T12:00:00.000Z',
    map: [],
    objects: [],
    visibility: true,
    ...overrides,
  });

  beforeEach(async () => {
    mapServiceSpy = jasmine.createSpyObj<MapService>('MapService', ['getAllMaps', 'deleteMap', 'updateMapVisibility']);
    adminServiceSpy = jasmine.createSpyObj<AdminService>('AdminService', ['setMapProperties', 'fetchExistingMapForEditor']);

    await TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        provideRouter([]),
        { provide: MapService, useValue: mapServiceSpy },
        { provide: AdminService, useValue: adminServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  const create = (): void => {
    fixture = TestBed.createComponent(AdminPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const getText = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  const clickCreateButton = (): void => {
    const btn = (fixture.nativeElement as HTMLElement).querySelector('.create-button button') as HTMLButtonElement | null;
    expect(btn).withContext('Expected to find the create button in the admin page header').not.toBeNull();
    btn?.click();
  };

  const getCreateDialog = (): CreateMapDialogComponent | null => {
    const dialog = fixture.debugElement.query(By.directive(CreateMapDialogComponent));
    if (!dialog) return null;
    return dialog.componentInstance as CreateMapDialogComponent;
  };

  const openCreateDialog = (): CreateMapDialogComponent => {
    clickCreateButton();
    fixture.detectChanges();

    const dialog = getCreateDialog();
    expect(dialog).not.toBeNull();
    return dialog as CreateMapDialogComponent;
  };

  const getGameCardDebugs = () => fixture.debugElement.queryAll(By.directive(GameCardComponent));

  const clickFirstCardButton = (ariaLabel: string): void => {
    const card = getGameCardDebugs()[0];
    expect(card).withContext('Expected at least one game card in the admin list').toBeTruthy();

    const btn = card.nativeElement.querySelector(`button[aria-label="${ariaLabel}"]`) as HTMLButtonElement | null;
    expect(btn).withContext(`Expected to find button aria-label="${ariaLabel}" on first card`).not.toBeNull();
    btn?.click();
  };

  const getDeleteDialog = (): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');

  const clickDeleteDialogButton = (label: string): void => {
    const dialog = getDeleteDialog();
    expect(dialog).withContext('Expected delete dialog to be open').not.toBeNull();

    const buttons = Array.from((dialog as HTMLElement).querySelectorAll('button')) as HTMLButtonElement[];
    const btn = buttons.find((b) => (b.textContent ?? '').includes(label));
    expect(btn).withContext(`Expected to find "${label}" button inside delete dialog`).toBeDefined();
    btn?.click();
  };

  it('should show loading state while maps are loading', () => {
    const subject = new Subject<EditorMap[]>();
    mapServiceSpy.getAllMaps.and.returnValue(subject.asObservable());

    create();

    expect(getText()).toContain('Chargement des cartes...');

    subject.next([makeMap()]);
    subject.complete();
  });

  it('should show an error message when map loading fails', () => {
    mapServiceSpy.getAllMaps.and.returnValue(throwError(() => new Error('fail')));

    create();

    expect(getText()).toContain('Impossible de charger les cartes pour le moment.');
  });

  it('should render maps when loading succeeds', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap({ id: 'a', name: 'A' }), makeMap({ id: 'b', name: 'B' })]));

    create();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('article.card');
    expect(cards.length).toBe(2);
    expect(el.textContent).toContain('A');
    expect(el.textContent).toContain('B');
  });

  it('should open create dialog on create button click', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([]));
    create();

    clickCreateButton();
    fixture.detectChanges();

    expect(getCreateDialog()).not.toBeNull();
  });

  it('should navigate to editor on create confirm when AdminService accepts config', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([]));
    adminServiceSpy.setMapProperties.and.returnValue(true);
    create();

    const dialog = openCreateDialog();
    dialog.confirm.emit({ mode: GameMode.CLASSIC, size: MapSize.S });
    fixture.detectChanges();

    expect(adminServiceSpy.setMapProperties).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/editor']);
    expect(getCreateDialog()).toBeNull();
  });

  it('should set an error on create confirm when AdminService rejects config', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([]));
    adminServiceSpy.setMapProperties.and.returnValue(false);
    create();

    const dialog = openCreateDialog();
    dialog.confirm.emit({ mode: GameMode.CLASSIC, size: MapSize.S });
    fixture.detectChanges();

    expect(getText()).toContain("Impossible d'aller rechercher la carte.");
    expect(getCreateDialog()).not.toBeNull();
  });

  it('should navigate to editor on edit when map fetch succeeds', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    adminServiceSpy.fetchExistingMapForEditor.and.returnValue(of(true));
    create();

    const gameCard = fixture.debugElement.query(By.directive(GameCardComponent));
    const editBtn = gameCard.nativeElement.querySelector('button[aria-label=\"Modifier\"]') as HTMLButtonElement;
    editBtn.click();

    expect(adminServiceSpy.fetchExistingMapForEditor).toHaveBeenCalledWith('id-1');
    expect(router.navigate).toHaveBeenCalledWith(['/editor']);
  });

  it('should show an error on edit when map fetch fails', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    adminServiceSpy.fetchExistingMapForEditor.and.returnValue(of(false));
    create();

    const gameCard = fixture.debugElement.query(By.directive(GameCardComponent));
    const editBtn = gameCard.nativeElement.querySelector('button[aria-label=\"Modifier\"]') as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    expect(getText()).toContain("Impossible d'aller rechercher la carte.");
  });

  it('should open and close delete dialog', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    create();

    clickFirstCardButton('Supprimer');
    fixture.detectChanges();

    const dialog = getDeleteDialog();
    expect(dialog).not.toBeNull();
    expect((dialog as HTMLElement).textContent).toContain('Map 1');

    clickDeleteDialogButton('Annuler');
    fixture.detectChanges();

    expect(getDeleteDialog()).toBeNull();
  });

  it('closeDeleteDialog() should do nothing while deleting', () => {
    const deleteSubject = new Subject<void>();
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    mapServiceSpy.deleteMap.and.returnValue(deleteSubject.asObservable());
    create();

    clickFirstCardButton('Supprimer');
    fixture.detectChanges();

    clickDeleteDialogButton('Supprimer');
    fixture.detectChanges();

    (component as unknown as AdminPageInternals).closeDeleteDialog();
    fixture.detectChanges();

    expect(getDeleteDialog()).not.toBeNull();
  });

  it('confirmDeleteMap() should early-return when no pending map', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([]));
    create();

    (component as unknown as AdminPageInternals).confirmDeleteMap();
    expect(mapServiceSpy.deleteMap).not.toHaveBeenCalled();
  });

  it('confirmDeleteMap() should early-return when already deleting', () => {
    const deleteSubject = new Subject<void>();
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    mapServiceSpy.deleteMap.and.returnValue(deleteSubject.asObservable());
    create();

    clickFirstCardButton('Supprimer');
    fixture.detectChanges();
    clickDeleteDialogButton('Supprimer');
    fixture.detectChanges();

    (component as unknown as AdminPageInternals).confirmDeleteMap();
    expect(mapServiceSpy.deleteMap).toHaveBeenCalledTimes(1);
  });

  it('should delete a map and remove it from the list on confirm', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    mapServiceSpy.deleteMap.and.returnValue(of(void 0));
    create();

    clickFirstCardButton('Supprimer');
    fixture.detectChanges();
    clickDeleteDialogButton('Supprimer');
    fixture.detectChanges();

    expect(mapServiceSpy.deleteMap).toHaveBeenCalledWith('id-1');
    expect(getDeleteDialog()).toBeNull();
    expect(getText()).toContain("Aucune carte n'est disponible.");
  });

  it('should show an error when delete fails', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap()]));
    mapServiceSpy.deleteMap.and.returnValue(throwError(() => new Error('fail')));
    create();

    clickFirstCardButton('Supprimer');
    fixture.detectChanges();
    clickDeleteDialogButton('Supprimer');
    fixture.detectChanges();

    expect(getDeleteDialog()).toBeNull();
    expect(getText()).toContain('Impossible de supprimer la carte pour le moment.');
  });

  it('should toggle visibility and update the map in the list', () => {
    const initial = makeMap({ id: 'id-1', visibility: true });
    const untouched = makeMap({ id: 'id-2', name: 'Map 2', visibility: true });
    const updated = makeMap({ id: 'id-1', visibility: false });
    mapServiceSpy.getAllMaps.and.returnValue(of([initial, untouched]));
    mapServiceSpy.updateMapVisibility.and.returnValue(of(updated));
    create();

    clickFirstCardButton('Masquer');
    fixture.detectChanges();

    expect(mapServiceSpy.updateMapVisibility).toHaveBeenCalledWith('id-1', false);

    const cards = getGameCardDebugs();
    expect(cards.length).toBe(2);

    const firstToggle = cards[0].nativeElement.querySelector(
      'button[aria-label="Visible"], button[aria-label="Masquer"]',
    ) as HTMLButtonElement | null;
    expect(firstToggle?.getAttribute('aria-label')).toBe('Visible');

    const secondToggle = cards[1].nativeElement.querySelector(
      'button[aria-label="Visible"], button[aria-label="Masquer"]',
    ) as HTMLButtonElement | null;
    expect(secondToggle?.getAttribute('aria-label')).toBe('Masquer');
  });

  it('should show an error when visibility toggle fails', () => {
    mapServiceSpy.getAllMaps.and.returnValue(of([makeMap({ visibility: true })]));
    mapServiceSpy.updateMapVisibility.and.returnValue(throwError(() => new Error('fail')));
    create();

    clickFirstCardButton('Masquer');
    fixture.detectChanges();

    expect(getText()).toContain('Impossible de modifier la visibilite pour le moment.');
  });
});
