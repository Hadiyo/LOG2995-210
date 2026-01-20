import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorTopbarComponent } from './editor-topbar.component';

describe('EditorTopbarComponent', () => {
  let component: EditorTopbarComponent;
  let fixture: ComponentFixture<EditorTopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorTopbarComponent],
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
