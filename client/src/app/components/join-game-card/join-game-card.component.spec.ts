import { ComponentFixture, TestBed } from '@angular/core/testing';

import { By } from '@angular/platform-browser';
import { GameSessionPreview } from '@common/game/game-session.interface';
import { GameMode, MapSize } from '@common/maps/map.enums';
import { JoinGameCardComponent } from './join-game-card.component';

describe('JoinGameCardComponent', () => {
  let component: JoinGameCardComponent;
  let fixture: ComponentFixture<JoinGameCardComponent>;

  const mockSession: GameSessionPreview = {
    id: '123',
    name: 'Test Session',
    description: 'A test session',
    mode: GameMode.CLASSIC,
    size: MapSize.S,
    nbOfPlayers: 2,
    previewImage: 'abc123',
    previewImageFormat: 'webp',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoinGameCardComponent],
    })
      .compileComponents();

    fixture = TestBed.createComponent(JoinGameCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();

  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit select event with session id on card click', () => {
    component.session = mockSession;

    const selectSpy = jasmine.createSpy('select');
    component.select.subscribe(selectSpy);

    const card = fixture.debugElement.query(By.css('article.card'));
    card.triggerEventHandler('click', null);

    expect(selectSpy).toHaveBeenCalledOnceWith(mockSession.id);
  });
});
