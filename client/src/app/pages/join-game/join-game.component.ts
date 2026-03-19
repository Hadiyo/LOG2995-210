import { Component, computed, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BackButtonComponent } from '@app/components/back-button/back-button.component';
import { JoinGameCardComponent } from '@app/components/join-game-card/join-game-card.component';
import { WaitingRoomDirectoryService } from '@app/services/waiting-room/waiting-room-directory.service';

@Component({
  selector: 'app-join-game',
  imports: [BackButtonComponent, JoinGameCardComponent],
  templateUrl: './join-game.component.html',
  styleUrl: './join-game.component.scss',
})
export class JoinGameComponent implements OnInit, OnDestroy {
  protected readonly previews = this.waitingRoomDirectory.previews;
  protected readonly errorMessage = this.waitingRoomDirectory.errorMessage;
  protected readonly isLoading = computed(() => this.waitingRoomDirectory.state() === 'loading');
  constructor(
    private readonly waitingRoomDirectory: WaitingRoomDirectoryService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.waitingRoomDirectory.init();
  }

  ngOnDestroy(): void {
    this.waitingRoomDirectory.destroy();
  }

  onSelectedSession(accessCode: string): void {
    void this.router.navigate(['/character-creation'], {
      queryParams: { accessCode },
    });
  }
}
