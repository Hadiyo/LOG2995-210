import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AvatarId, DieTargetAttributeName, PlusTwoAttributeName } from '@common/character/character.model';

@Component({
  selector: 'app-character-creation-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-creation-preview.component.html',
  styleUrl: './character-creation-preview.component.scss',
})
export class CharacterCreationPreviewComponent {
  @Input() avatarId: AvatarId | null = null;
  @Input() avatarBackground: string | null = null;
  @Input() avatarThumbPath: string | null = null;
  @Input() displayName = 'Sans nom';
  @Input() subtitle: string | null = null;
  @Input() description: string | null = null;
  @Input() plusTwo: PlusTwoAttributeName = 'vie';
  @Input() d6GoesTo: DieTargetAttributeName = 'attaque';
  @Input() isLocked = false;

  @Output() leave = new EventEmitter<void>();

  protected attackMaxLabel(): string {
    return this.d6GoesTo === 'attaque' ? '10 Max' : '8 Max';
  }

  protected attackHint(): string {
    return this.d6GoesTo === 'attaque' ? '4 + D6' : '4 + D4';
  }

  protected defenseMaxLabel(): string {
    return this.d6GoesTo === 'defense' ? '10 Max' : '8 Max';
  }

  protected defenseHint(): string {
    return this.d6GoesTo === 'defense' ? '4 + D6' : '4 + D4';
  }
}