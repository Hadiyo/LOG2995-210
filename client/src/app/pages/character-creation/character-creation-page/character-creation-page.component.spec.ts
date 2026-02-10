import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CharacterCreationPageComponent } from './character-creation-page.component';

describe('CharacterCreationPageComponent', () => {
  let component: CharacterCreationPageComponent;
  let fixture: ComponentFixture<CharacterCreationPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterCreationPageComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CharacterCreationPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
