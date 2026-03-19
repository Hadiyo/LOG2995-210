import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CharacterSpriteComponent } from '@app/components/game/character-sprite/character-sprite.component';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { Player } from '@common/player/player.interface';

@Component({
  selector: 'app-game-current-player-panel',
  standalone: true,
  imports: [CommonModule, CharacterSpriteComponent],
  templateUrl: './game-current-player-panel.component.html',
  styleUrl: './game-current-player-panel.component.scss',
})
export class GameCurrentPlayerPanelComponent {
  @Input() player: Player | null = null;
  @Input() avatarId = 0;
  @Input() avatarState: CharacterState = 'idle';
  @Input() avatarDirection: CharacterDirection = 'front';
  @Input() avatarSpriteSize = 96;
  @Input() defaultPanelTitle = 'N/A';
  @Input() debugModeEnabled = false;
}
