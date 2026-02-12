import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorCanvasComponent } from './editor-canvas.component';

describe('EditorCanvasComponent', () => {
  let component: EditorCanvasComponent;
  let fixture: ComponentFixture<EditorCanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorCanvasComponent],
    })
      .compileComponents();

    fixture = TestBed.createComponent(EditorCanvasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
