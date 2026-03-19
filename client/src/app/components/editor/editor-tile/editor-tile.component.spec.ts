import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorTileComponent } from './editor-tile.component';
import { ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';

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
    fixture.componentRef.setInput('tile', {
      position: { x: 0, y: 0 },
      tileType: TileType.DIRT,
      isWalkable: true,
      isOccupied: false,
    });
    fixture.componentRef.setInput('object', null);

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render an object on its anchor tile', () => {
    fixture.componentRef.setInput('object', {
      id: 1,
      type: ObjectType.START,
      position: { x: 0, y: 0 },
      size: ObjectSize.L,
    });

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.obj')).not.toBeNull();
  });

  it('should not render a 2x2 object on covered non-anchor tiles', () => {
    fixture.componentRef.setInput('tile', {
      ...component.tile,
      position: { x: 1, y: 0 },
    });
    fixture.componentRef.setInput('object', {
      id: 1,
      type: ObjectType.START,
      position: { x: 0, y: 0 },
      size: ObjectSize.L,
    });

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.obj')).toBeNull();
  });
});
