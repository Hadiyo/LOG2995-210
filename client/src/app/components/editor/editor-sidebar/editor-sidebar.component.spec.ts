import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameMode } from '@common/maps/map.enums';
import { EditorSidebarComponent } from './editor-sidebar.component';

describe('EditorSidebarComponent', () => {
  let component: EditorSidebarComponent;
  let fixture: ComponentFixture<EditorSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorSidebarComponent],
    })
      .compileComponents();

    fixture = TestBed.createComponent(EditorSidebarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show a flag object in classic mode palette', () => {
    component.editorState.setMode(GameMode.CLASSIC);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const labels = Array.from(element.querySelectorAll('.palette .label')).map((node) => node.textContent?.trim());

    expect(labels).not.toContain('Drapeau');
  });

  it('should show advanced editor objects when available', () => {
    component.editorState.setMode(GameMode.CTF);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const labels = Array.from(element.querySelectorAll('.palette .label')).map((node) => node.textContent?.trim());

    expect(labels).toContain('Drapeau');
    expect(labels).toContain('Sanctuaire de soin');
    expect(labels).toContain('Sanctuaire de combat');
  });
});
