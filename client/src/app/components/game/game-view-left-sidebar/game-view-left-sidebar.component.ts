import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameCurrentPlayerPanelComponent } from '@app/components/game/game-current-player-panel/game-current-player-panel.component';
import { GameSessionInfoPanelComponent } from '@app/components/game/game-session-info-panel/game-session-info-panel.component';
import { CharacterDirection, CharacterState } from '@app/shared/character/character.types';
import { MatchPlayer } from '@common/game/match.interface';
import { Player, PlayerFacing, PlayerPose } from '@common/player/player.interface';

type LeftPanelTab = 'player' | 'turn-order';

@Component({
  selector: 'app-game-view-left-sidebar',
  standalone: true,
  imports: [CommonModule, GameSessionInfoPanelComponent, GameCurrentPlayerPanelComponent],
  templateUrl: './game-view-left-sidebar.component.html',
  styleUrl: './game-view-left-sidebar.component.scss',
})
export class GameViewLeftSidebarComponent {
  @Input() mapName: string | null = null;
  @Input() cols = 1;
  @Input() rows = 1;
  @Input() activePlayersCount = 0;
  @Input() maxPlayers = 0;
  @Input() activePanelName: string | null = null;
  @Input() remainingSeconds = 0;
  @Input() totalSeconds = 30;
  @Input() highlightTimer = true;
  @Input() defaultPanelTitle = 'N/A';
  @Input() leftPanelTab: LeftPanelTab = 'player';
  @Input() currentPlayer: Player | null = null;
  @Input() avatarId = 0;
  @Input() avatarState: CharacterState = PlayerPose.Idle;
  @Input() avatarDirection: CharacterDirection = PlayerFacing.Front;
  @Input() avatarSpriteSize = 96;
  @Input() debugModeEnabled = false;
  @Input() turnDetails: readonly MatchPlayer[] = [];

  @Output() leftPanelTabChange = new EventEmitter<LeftPanelTab>();

  protected onSelectTab(tab: LeftPanelTab): void {
    this.leftPanelTabChange.emit(tab);
  }
}