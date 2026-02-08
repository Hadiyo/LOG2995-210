import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MapService } from '@app/services/map.service';
import { GameMode, MapSize } from '@common/enum';
import type { EditorMap } from '@common/interface';

describe('MapService', () => {
  let httpMock: HttpTestingController;
  let service: MapService;

  const makeMap = (overrides: Partial<EditorMap> = {}): EditorMap => ({
    id: '',
    name: 'Map',
    description: 'Desc',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    date: '2026-02-08T12:00:00.000Z',
    map: [],
    objects: [],
    visibility: true,
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });

    service = TestBed.inject(MapService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAllMaps() should GET /maps/', () => {
    const expected = [makeMap({ id: '1' })];

    service.getAllMaps().subscribe((maps) => expect(maps).toEqual(expected));

    const req = httpMock.expectOne((request) => request.method === 'GET' && request.url.endsWith('/maps/'));
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });

  it('getVisibleMaps() should GET /maps/visible', () => {
    const expected = [makeMap({ id: '1', visibility: true })];

    service.getVisibleMaps().subscribe((maps) => expect(maps).toEqual(expected));

    const req = httpMock.expectOne((request) => request.method === 'GET' && request.url.endsWith('/maps/visible'));
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });

  it('getMapById() should GET /maps/:id', () => {
    const expected = makeMap({ id: 'abc' });

    service.getMapById('abc').subscribe((map) => expect(map).toEqual(expected));

    const req = httpMock.expectOne((request) => request.method === 'GET' && request.url.endsWith('/maps/abc'));
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });

  it('saveMap() should POST when id is empty/blank', () => {
    const toCreate = makeMap({ id: '   ' });
    const created = makeMap({ id: 'new-id' });

    service.saveMap(toCreate).subscribe((map) => expect(map).toEqual(created));

    const req = httpMock.expectOne((request) => request.method === 'POST' && request.url.endsWith('/maps/'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(toCreate);
    req.flush(created);
  });

  it('saveMap() should PUT when id is set', () => {
    const toUpdate = makeMap({ id: 'id-1' });

    service.saveMap(toUpdate).subscribe((map) => expect(map).toEqual(toUpdate));

    const req = httpMock.expectOne((request) => request.method === 'PUT' && request.url.endsWith('/maps/id-1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(toUpdate);
    req.flush(toUpdate);
  });

  it('updateMapVisibility() should PATCH /maps/:id/visibility', () => {
    const updated = makeMap({ id: 'id-1', visibility: false });

    service.updateMapVisibility('id-1', false).subscribe((map) => expect(map).toEqual(updated));

    const req = httpMock.expectOne(
      (request) => request.method === 'PATCH' && request.url.endsWith('/maps/id-1/visibility'),
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ visibility: false });
    req.flush(updated);
  });

  it('deleteMap() should DELETE /maps/:id', () => {
    service.deleteMap('id-1').subscribe();

    const req = httpMock.expectOne((request) => request.method === 'DELETE' && request.url.endsWith('/maps/id-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
