import { NgClass } from '@angular/common';
import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppMaterialModule } from '@app/modules/material.module';

// TODO : Avoir un fichier séparé pour les constantes!
export const MATERIAL_PREBUILT_THEMES = [
    {
        value: 'indigo-pink-theme',
        label: 'Indigo & Pink',
    },
    {
        value: 'deeppurple-amber-theme',
        label: 'Deep Purple & Amber',
    },
    {
        value: 'pink-bluegrey-theme',
        label: 'Pink & Blue-grey',
    },
    {
        value: 'purple-green-theme',
        label: 'Purple & Green',
    },
];

export const MATERIAL_DEFAULT_PREBUILT_THEME = MATERIAL_PREBUILT_THEMES[0];

@Component({
    selector: 'app-material-page',
    templateUrl: './material-page.component.html',
    styleUrls: ['./material-page.component.scss'],
    imports: [AppMaterialModule, FormsModule, NgClass],
})
export class MaterialPageComponent {
    @ViewChild('merciDialogContent')
    private readonly merciDialogContentRef: TemplateRef<HTMLElement>;

    readonly themes = MATERIAL_PREBUILT_THEMES;

    favoriteTheme: string = MATERIAL_DEFAULT_PREBUILT_THEME.value;

    private readonly router = inject(Router);

    constructor(private readonly matDialog: MatDialog) {}

    onLikeTheme(): void {
        this.matDialog.open(this.merciDialogContentRef);
    }

    onBack() {
        this.router.navigate(['/home']);
    }
}
