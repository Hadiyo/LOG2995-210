import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { MaterialPageComponent } from '@app/pages/material-page/material-page.component';
import { of } from 'rxjs';

export class MatDialogMock {
    open() {
        return {
            afterClosed: () => of({}),
        };
    }
}

describe('MaterialPageComponent', () => {
    let component: MaterialPageComponent;
    let fixture: ComponentFixture<MaterialPageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MaterialPageComponent],
            providers: [{ provide: MatDialog, useClass: MatDialogMock }, provideAnimations()],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(MaterialPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('onLikeLoremTheme() should open a dialog', () => {
        const spy = spyOn(component['matDialog'], 'open');
        component.onLikeTheme();
        expect(spy).toHaveBeenCalled();
    });

    it('onBack() should navigate to /home', () => {
        const router = TestBed.inject(Router);
        const spy = spyOn(router, 'navigate');
        component.onBack();
        expect(spy).toHaveBeenCalledWith(['/home']);
    });
});
