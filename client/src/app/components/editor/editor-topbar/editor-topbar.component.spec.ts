import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { EditorTopbarComponent } from './editor-topbar.component';
import { GameService } from 'src/app/services/game.service';

describe('EditorTopbarComponent', () => {
  let component: EditorTopbarComponent;
  let fixture: ComponentFixture<EditorTopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorTopbarComponent],
      providers: [
        provideRouter([]),
        {
          provide: GameService,
          useValue: {
            saveGame: () => of(),
          },
        },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(EditorTopbarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
