import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TileType } from '@common/enum';
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

    // mock a cell
    component.tile = {
      position: { x: 0, y: 0 },
      tileType: TileType.DIRT,
      isWalkable: true,
      isOccupied: false,
    };

    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
