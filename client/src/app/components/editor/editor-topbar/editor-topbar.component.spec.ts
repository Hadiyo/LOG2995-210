import { Overlay } from '@angular/cdk/overlay';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { EditorTopbarComponent } from '@app/components/editor/editor-topbar/editor-topbar.component';
import { EditorStateService } from '@app/services/editor/editor-state.service';
import { MapService } from '@app/services/map.service';
import { MapThumbnailService } from '@app/services/map-thumbnail.service';
import { GameMode, MapSize, MouseButton, ObjectSize, ObjectType } from '@common/enum';
import { PreviewImageFormat, type EditorMap } from '@common/interface';

describe('EditorTopbarComponent', () => {
  let component: EditorTopbarComponent;
  let fixture: ComponentFixture<EditorTopbarComponent>;

  let editorStateMock: {
    activeButton: WritableSignal<MouseButton | null>;
    isShiftPressed: WritableSignal<boolean>;
    editorMap: WritableSignal<EditorMap>;
    resetMap: jasmine.Spy;
    clearSelection: jasmine.Spy;
    setMode: jasmine.Spy;
    setSize: jasmine.Spy;
    loadMap: jasmine.Spy;
  };

  let routerMock: { navigate: jasmine.Spy };
  let overlayRef: { attach: jasmine.Spy; backdropClick: jasmine.Spy; dispose: jasmine.Spy };
  let close$: Subject<void>;
  let confirm$: Subject<void>;
  let backdrop$: Subject<void>;
  let overlayMock: Overlay;
  let mapServiceSpy: jasmine.SpyObj<MapService>;
  let thumbnailSpy: jasmine.SpyObj<MapThumbnailService>;

  const makeValidMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
    id: 'id-1',
    name: 'Valid name',
    description: 'Valid description',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: '2026-02-08T12:00:00.000Z',
    map: [],
    objects: [
      { id: 1, type: ObjectType.START, position: { x: 0, y: 0 }, size: ObjectSize.S },
      { id: 2, type: ObjectType.START, position: { x: 1, y: 0 }, size: ObjectSize.S },
    ],
    visibility: true,
    ...overrides,
  });

  const makeInvalidMap = (): EditorMap => makeValidMap({ name: '' });

  beforeEach(async () => {
    close$ = new Subject<void>();
    confirm$ = new Subject<void>();
    backdrop$ = new Subject<void>();

    overlayRef = {
      attach: jasmine.createSpy('attach').and.returnValue({
        instance: {
          closePopUp: close$,
          confirmPopUp: confirm$,
        },
      }),
      backdropClick: jasmine.createSpy('backdropClick').and.returnValue(backdrop$),
      dispose: jasmine.createSpy('dispose'),
    };

    overlayMock = {
      position: () => ({
        global: () => ({
          centerHorizontally: () => ({
            centerVertically: () => ({}),
          }),
        }),
      }),
      create: () => overlayRef,
    } as unknown as Overlay;

    editorStateMock = {
      activeButton: signal<MouseButton | null>(null),
      isShiftPressed: signal<boolean>(false),
      editorMap: signal<EditorMap>(makeInvalidMap()),
      resetMap: jasmine.createSpy('resetMap'),
      clearSelection: jasmine.createSpy('clearSelection'),
      setMode: jasmine.createSpy('setMode'),
      setSize: jasmine.createSpy('setSize'),
      loadMap: jasmine.createSpy('loadMap'),
    };

    routerMock = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    mapServiceSpy = jasmine.createSpyObj<MapService>('MapService', ['saveMap']);
    thumbnailSpy = jasmine.createSpyObj<MapThumbnailService>('MapThumbnailService', ['generatePreview']);

    await TestBed.configureTestingModule({
      imports: [EditorTopbarComponent],
      providers: [
        { provide: EditorStateService, useValue: editorStateMock },
        { provide: Router, useValue: routerMock },
        { provide: Overlay, useValue: overlayMock },
        { provide: MapService, useValue: mapServiceSpy },
        { provide: MapThumbnailService, useValue: thumbnailSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorTopbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('setMode() and setSize() should delegate to EditorStateService', () => {
    component.setMode(GameMode.CTF);
    component.setSize(MapSize.M);

    expect(editorStateMock.setMode).toHaveBeenCalledOnceWith(GameMode.CTF);
    expect(editorStateMock.setSize).toHaveBeenCalledOnceWith(MapSize.M);
  });

  it('onReset() should reset the map', () => {
    component.onReset();
    expect(editorStateMock.resetMap).toHaveBeenCalled();
  });

  it('onCancel() should clear selection', () => {
    component.onCancel();
    expect(editorStateMock.clearSelection).toHaveBeenCalled();
  });

  it('onBack() should dispose overlay on close/backdrop and navigate on confirm', () => {
    component.onBack();

    close$.next();
    expect(overlayRef.dispose).toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();

    overlayRef.dispose.calls.reset();
    backdrop$.next();
    expect(overlayRef.dispose).toHaveBeenCalled();

    overlayRef.dispose.calls.reset();
    confirm$.next();
    expect(overlayRef.dispose).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/admin']);
  });

  // REQ: Le systeme ne doit pas appliquer un changement si la vue d'edition a ete quittee sans un enregistrement valide.
  it('onBack() should not persist changes when leaving without a valid save', () => {
    editorStateMock.editorMap.set(makeInvalidMap());
    fixture.detectChanges();

    const backButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label=\"Retour\"]',
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();

    backButton?.click();
    confirm$.next();

    expect(mapServiceSpy.saveMap).not.toHaveBeenCalled();
    expect(thumbnailSpy.generatePreview).not.toHaveBeenCalled();
  });

  // REQ: Le systeme doit valider un jeu pour un enregistrement reussi.
  it('onSave() should not call server when local validation fails', async () => {
    editorStateMock.editorMap.set(makeInvalidMap());
    mapServiceSpy.saveMap.and.returnValue(of(makeValidMap()));

    await component.onSave();

    expect(component.hasAttemptedSave()).toBeTrue();
    expect(thumbnailSpy.generatePreview).not.toHaveBeenCalled();
    expect(mapServiceSpy.saveMap).not.toHaveBeenCalled();
  });

  // REQ: Le systeme doit avertir l'utilisateur en cas de jeu invalide avec les raisons d'invalidite.
  it('onSave() should show local validation issues in the UI after an invalid save attempt', async () => {
    editorStateMock.editorMap.set(makeInvalidMap());

    await component.onSave();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const alert = el.querySelector('.validation-panel[role=\"alert\"]') as HTMLElement | null;
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Le nom de la carte est requis.');
  });

  // REQ: Le systeme doit generer une image de previsualisation apres un enregistrement reussi.
  // REQ: Le systeme doit rediriger l'utilisateur vers la vue d'administration apres un enregistrement reussi.
  // REQ: Un jeu cree ou modifie doit avoir un parametre de visibilite cache.
  it('onSave() should generate a preview, save the map, load it and navigate', async () => {
    const current = makeValidMap({ id: '' });
    const saved = makeValidMap({ id: 'saved-id', visibility: false });
    editorStateMock.editorMap.set(current);

    thumbnailSpy.generatePreview.and.resolveTo({ data: 'PREVIEW', format: PreviewImageFormat.PNG });
    mapServiceSpy.saveMap.and.returnValue(of(saved));

    await component.onSave();
    fixture.detectChanges();

    expect(thumbnailSpy.generatePreview).toHaveBeenCalledWith(current);
    expect(mapServiceSpy.saveMap).toHaveBeenCalledWith(
      jasmine.objectContaining({
        id: current.id,
        name: current.name,
        description: current.description,
        mode: current.mode,
        size: current.size,
        map: current.map,
        objects: current.objects,
        visibility: false,
        previewImage: 'PREVIEW',
        previewImageFormat: PreviewImageFormat.PNG,
      }),
    );
    expect(editorStateMock.loadMap).toHaveBeenCalledWith(saved);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/admin']);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.validation-panel[role=\"alert\"]')).toBeNull();
  });

  // REQ: Le systeme doit permettre l'enregistrement d'un jeu dans la vue d'edition a travers un bouton.
  it('onSave() should call the save flow when the save button is clicked', async () => {
    const current = makeValidMap({ id: '' });
    editorStateMock.editorMap.set(current);
    fixture.detectChanges();

    thumbnailSpy.generatePreview.and.resolveTo({ data: 'PREVIEW', format: PreviewImageFormat.PNG });
    mapServiceSpy.saveMap.and.returnValue(of(makeValidMap({ id: 'saved' })));

    const saveButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label=\"Enregistrer\"]',
    ) as HTMLButtonElement | null;
    expect(saveButton).not.toBeNull();

    saveButton?.click();
    await fixture.whenStable();

    expect(mapServiceSpy.saveMap).toHaveBeenCalled();
  });

  it('onSave() should show server validation issues on 400 responses', async () => {
    editorStateMock.editorMap.set(makeValidMap());
    thumbnailSpy.generatePreview.and.resolveTo(null);

    const error = new HttpErrorResponse({
      status: HttpStatusCode.BadRequest,
      error: { isValid: false, issues: [{ code: 'NAME_REQUIRED', message: 'Le nom de la carte est requis.' }] },
    });
    mapServiceSpy.saveMap.and.returnValue(throwError(() => error));

    spyOn(window, 'alert');
    await component.onSave();
    fixture.detectChanges();

    expect(window.alert).not.toHaveBeenCalled();
    expect(component.serverIssues().length).toBe(1);
    expect(component.serverIssues()[0].code).toBe('NAME_REQUIRED');

    const el: HTMLElement = fixture.nativeElement;
    const alert = el.querySelector('.validation-panel[role=\"alert\"]') as HTMLElement | null;
    expect(alert?.textContent).toContain('Le nom de la carte est requis.');
  });

  it('onSave() should alert when save fails with a non-HTTP error', async () => {
    editorStateMock.editorMap.set(makeValidMap());
    thumbnailSpy.generatePreview.and.resolveTo(null);
    mapServiceSpy.saveMap.and.returnValue(throwError(() => new Error('boom')));

    spyOn(window, 'alert');
    await component.onSave();

    expect(window.alert).toHaveBeenCalledWith('Echec de la sauvegarde.');
  });

  it('onSave() should alert when HTTP status is not 400', async () => {
    editorStateMock.editorMap.set(makeValidMap());
    thumbnailSpy.generatePreview.and.resolveTo(null);

    const error = new HttpErrorResponse({
      status: HttpStatusCode.InternalServerError,
      error: { message: 'server down' },
    });
    mapServiceSpy.saveMap.and.returnValue(throwError(() => error));

    spyOn(window, 'alert');
    await component.onSave();

    expect(window.alert).toHaveBeenCalledWith('Echec de la sauvegarde.');
  });

  it('onSave() should alert when 400 payload is not a MapValidationResult', async () => {
    editorStateMock.editorMap.set(makeValidMap());
    thumbnailSpy.generatePreview.and.resolveTo(null);

    const error = new HttpErrorResponse({ status: HttpStatusCode.BadRequest, error: { issues: 'not-an-array' } });
    mapServiceSpy.saveMap.and.returnValue(throwError(() => error));

    spyOn(window, 'alert');
    await component.onSave();

    expect(window.alert).toHaveBeenCalledWith('Echec de la sauvegarde.');
  });
});
