import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayAreaComponent } from '@app/components/play-area/play-area.component';
import { TimeService } from '@app/services/time.service';
import SpyObj = jasmine.SpyObj;
import { signal } from '@angular/core';

describe('PlayAreaComponent', () => {
    let component: PlayAreaComponent;
    let fixture: ComponentFixture<PlayAreaComponent>;
    let timeServiceSpy: SpyObj<TimeService>;
    const testSignal = signal(0);

    beforeEach(async () => {
        timeServiceSpy = jasmine.createSpyObj('TimeService', ['startTimer', 'stopTimer'], { counter: testSignal, time: testSignal.asReadonly() });

        await TestBed.configureTestingModule({
            imports: [PlayAreaComponent],
            providers: [{ provide: TimeService, useValue: timeServiceSpy }],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(PlayAreaComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('buttonDetect should modify the buttonPressed variable', () => {
        const expectedKey = 'a';
        const buttonEvent = {
            key: expectedKey,
        } as KeyboardEvent;
        component.buttonDetect(buttonEvent);
        expect(component.buttonPressed).toEqual(expectedKey);
    });

    it('mouseHitDetect should call startTimer with 5 seconds on left click', () => {
        const mockEvent = { button: 0 } as MouseEvent;
        component.mouseHitDetect(mockEvent);
        expect(timeServiceSpy.startTimer).toHaveBeenCalled();
        expect(timeServiceSpy.startTimer).toHaveBeenCalledWith(component['timer']);
    });

    it('mouseHitDetect should not call startTimer on right click', () => {
        const mockEvent = { button: 2 } as MouseEvent;
        component.mouseHitDetect(mockEvent);
        expect(timeServiceSpy.startTimer).not.toHaveBeenCalled();
    });

    it('formattedTime should return the correct time format', () => {
        const TIME = 125;
        const EXPECTED_FORMATTED_TIME = '02:05';
        testSignal.set(TIME);
        expect(component.formattedTime()).toEqual(EXPECTED_FORMATTED_TIME);
    });

    it('timerExpired should be true when time is less than or equal to 2', () => {
        testSignal.set(2);
        fixture.detectChanges();
        expect(component.timerExpired()).toBeTrue();

        testSignal.set(1);
        fixture.detectChanges();
        expect(component.timerExpired()).toBeTrue();

        testSignal.set(0);
        fixture.detectChanges();
        expect(component.timerExpired()).toBeFalse();
    });

    it('timerExpired should be false when time is greater than 2', () => {
        const UPPER_LIMIT = 3;
        testSignal.set(UPPER_LIMIT);
        fixture.detectChanges();
        expect(component.timerExpired()).toBeFalse();
    });
});
