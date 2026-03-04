import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, enableProfiling, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { CharacterCreationPageComponent } from '@app/pages/character-creation/character-creation-page/character-creation-page.component';
import { CreateGamePageComponent } from '@app/pages/create-game-page/create-game-page.component';
import { EditorPageComponent } from '@app/pages/editor-page/editor-page.component';
import { GameViewPageComponent } from '@app/pages/game-view-page/game-view-page.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { WaitingRoomComponent } from '@app/pages/waiting-room/waiting-room.component';
import { environment } from './environments/environment';
//dev component, to be removed before release
import { DevGameLauncherComponent } from '@app/pages/dev-game-launcher/dev-game-launcher.component';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: MainPageComponent },
    { path: 'editor', component: EditorPageComponent },
    { path: 'game', component: CreateGamePageComponent },
    { path: 'admin', component: AdminPageComponent },
    { path: 'character-creation', component: CharacterCreationPageComponent },
    { path: 'waiting-room', component: WaitingRoomComponent },
    { path: 'game-view', component: GameViewPageComponent },
    //dev route, to be removed before release
    { path: 'dev-game-launcher', component: DevGameLauncherComponent },
    { path: '**', redirectTo: '/home' },

];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers:
        [
            provideZoneChangeDetection(),
            provideHttpClient(),
            provideRouter(routes, withHashLocation()),
            importProvidersFrom(
                OverlayModule,
                PortalModule,
            ),
        ],
});
