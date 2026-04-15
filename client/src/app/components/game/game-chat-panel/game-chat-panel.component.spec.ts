import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameChatPanelComponent } from './game-chat-panel.component';

describe('GameChatPanelComponent', () => {
    let fixture: ComponentFixture<GameChatPanelComponent>;
    let component: GameChatPanelComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameChatPanelComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GameChatPanelComponent);
        component = fixture.componentInstance;
        component.messages = [{
            id: 'log-1',
            author: 'Journal',
            content: 'Alice remporte un combat contre Bob.',
            createdAt: '2026-01-01T10:00:01.000Z',
            involvedPlayers: ['Alice', 'Bob'],
        }];
        component.readOnly = true;
        fixture.detectChanges();
    });

    it('renders involved players for journal entries', () => {
        const text = fixture.nativeElement.textContent;

        expect(text).toContain('Alice remporte un combat contre Bob.');
        expect(text).toContain('Joueurs: Alice, Bob');
    });
});
