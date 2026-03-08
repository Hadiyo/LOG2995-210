import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameSessionPreview } from '@common/game/game-session.interface';

@Component({
  selector: 'app-join-game-card',
  imports: [],
  templateUrl: './join-game-card.component.html',
  styleUrl: './join-game-card.component.scss',
})
export class JoinGameCardComponent {
  @Input() session!: GameSessionPreview;
  @Output() select = new EventEmitter<string>();

  onSelect(): void {
    this.select.emit(this.session.id);
  }
}
