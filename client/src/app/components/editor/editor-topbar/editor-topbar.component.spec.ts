import { Overlay } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MapService } from '@app/services/map/map-api.service';
import { EditorTopbarComponent } from './editor-topbar.component';

describe('EditorTopbarComponent', () => {
  let component: EditorTopbarComponent;
  let fixture: ComponentFixture<EditorTopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorTopbarComponent],
      providers: [
        provideRouter([]),
        {
          provide: MapService,
          useValue: {
            saveMap: () => of(),
          },
        },
        {
          provide: Overlay,
          useValue: {
            position: () => ({
              global: () => ({
                centerHorizontally: () => ({
                  centerVertically: () => ({}),
                }),
              }),
            }),
            create: () => ({
              attach: () => ({
                instance: {
                  closePopUp: of(),
                  confirmPopUp: of(),
                },
              }),
              backdropClick: () => of(),
              dispose: () => undefined,
            }),
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
