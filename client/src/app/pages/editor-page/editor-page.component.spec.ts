import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MapService } from '@app/services/map/map.service';
import { EditorPageComponent } from './editor-page.component';

describe('EditorPageComponent', () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: MapService,
          useValue: {
            saveMap: () => of(),
          },
        },
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(EditorPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
