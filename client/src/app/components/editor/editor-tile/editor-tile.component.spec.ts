import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorTileComponent } from './editor-tile.component';

describe('EditorTileComponent', () => {
  let component: EditorTileComponent;
  let fixture: ComponentFixture<EditorTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorTileComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditorTileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
