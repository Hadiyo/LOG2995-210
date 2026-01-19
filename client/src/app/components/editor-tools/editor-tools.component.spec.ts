import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorToolsComponent } from './editor-tools.component';

describe('EditorToolsComponent', () => {
  let component: EditorToolsComponent;
  let fixture: ComponentFixture<EditorToolsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorToolsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditorToolsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
