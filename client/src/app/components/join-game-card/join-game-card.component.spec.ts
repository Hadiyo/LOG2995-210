import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinGameCardComponent } from './join-game-card.component';

describe('JoinGameCardComponent', () => {
  let component: JoinGameCardComponent;
  let fixture: ComponentFixture<JoinGameCardComponent>;

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
});
