import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamePageComponent } from './game-page.component';
import { Component } from '@angular/core';
import { PlayAreaComponent } from '@app/components/play-area/play-area.component';

@Component({
    selector: 'app-sidebar',
})
class MockSidebarComponent {} // Retire la dépendance réelle au module de Routage

describe('GamePageComponent', () => {
    let component: GamePageComponent;
    let fixture: ComponentFixture<GamePageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GamePageComponent],
        }).compileComponents();

        TestBed.overrideComponent(GamePageComponent, {
            set: {
                imports: [MockSidebarComponent, PlayAreaComponent],
            },
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
