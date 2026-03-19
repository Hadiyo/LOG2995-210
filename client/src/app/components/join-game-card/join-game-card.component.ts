import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WaitingRoomPreview } from '@common/game/waiting-room-preview.interface';

@Component({
  selector: 'app-join-game-card',
  imports: [],
  templateUrl: './join-game-card.component.html',
  styleUrl: './join-game-card.component.scss',
})
export class JoinGameCardComponent {
  @Input() session!: WaitingRoomPreview;
  @Output() select = new EventEmitter<string>();

  get isLocked(): boolean {
    return this.session.playerCount >= this.session.maxPlayers;
  }

  onSelect(): void {
    if (this.isLocked) {
      return;
    }
    this.select.emit(this.session.accessCode);
  }
}
