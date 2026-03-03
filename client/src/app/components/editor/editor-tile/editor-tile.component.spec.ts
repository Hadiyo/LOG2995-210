import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorTileComponent } from './editor-tile.component';
import { TileType } from '@common/maps/map.enums';

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
