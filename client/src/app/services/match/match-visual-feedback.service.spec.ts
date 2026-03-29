import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatchVisualFeedbackService } from './match-visual-feedback.service';

describe('MatchVisualFeedbackService', () => {
    let service: MatchVisualFeedbackService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [MatchVisualFeedbackService],
        });

        service = TestBed.inject(MatchVisualFeedbackService);
    });

    afterEach(() => {
        service.resetVisualOverrides();
    });

    it('stores a visual direction override for the targeted player', () => {
        service.setVisualDirection('player-1', 'left');

        expect(service.playerDirections()['player-1']).toBe('left');
    });

    it('resets a transient visual state to idle after its duration', fakeAsync(() => {
        service.setVisualTransientState('player-1', 'walk', 200);

        expect(service.playerStates()['player-1']).toBe('walk');

        tick(200);

        expect(service.playerStates()['player-1']).toBe('idle');
    }));

    it('keeps a dead state sticky when an older timer resolves', fakeAsync(() => {
        service.setVisualTransientState('player-1', 'attack', 200);
        service.setVisualTransientState('player-1', 'dead', 50);

        tick(200);

        expect(service.playerStates()['player-1']).toBe('dead');
    }));

    it('clears all overrides and pending timers when resetting', fakeAsync(() => {
        service.setVisualDirection('player-1', 'front');
        service.setVisualTransientState('player-1', 'walk', 200);

        service.resetVisualOverrides();
        tick(200);

        expect(service.playerDirections()).toEqual({});
        expect(service.playerStates()).toEqual({});
    }));
});
