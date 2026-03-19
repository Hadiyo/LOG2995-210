import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionApiService } from '@app/services/session/session-api.service';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';

/**
 * Testing Strategy:
 * We validate the single public method fetchGameSessions() by checking that it
 * issues a GET request to the correct URL (/game-map/) and returns the server
 * response as an array of GameSessionPreview objects.
 *
 * We also verify the error path: when the server responds with an error status,
 * the observable propagates the error to the subscriber.
 */
describe('SessionApiService', () => {
  let service: SessionApiService;
  let httpMock: HttpTestingController;

  const makePreview = (overrides: Partial<GameSessionPreview> = {}): GameSessionPreview => ({
    id: 'session-1',
    name: 'Partie test',
    description: 'Description',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 1,
    maxPlayers: 4,
    isLocked: false,
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SessionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetchGameSessions() should GET /game-map/', () => {
    const expected = [makePreview({ id: '1' }), makePreview({ id: '2' })];

    service.fetchGameSessions().subscribe(sessions => expect(sessions).toEqual(expected));

    const req = httpMock.expectOne(r => r.method === 'GET' && r.url.endsWith('/game-map/'));
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });

  it('fetchGameSessions() should return an empty array when the server returns []', () => {
    service.fetchGameSessions().subscribe(sessions => expect(sessions).toEqual([]));

    const req = httpMock.expectOne(r => r.method === 'GET' && r.url.endsWith('/game-map/'));
    req.flush([]);
  });

  it('fetchGameSessions() should propagate HTTP errors to subscribers', () => {
    let errorReceived = false;

    service.fetchGameSessions().subscribe({
      next: () => fail('expected an error, not sessions'),
      error: () => (errorReceived = true),
    });

    const req = httpMock.expectOne(r => r.method === 'GET' && r.url.endsWith('/game-map/'));
    req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(errorReceived).toBeTrue();
  });
});
