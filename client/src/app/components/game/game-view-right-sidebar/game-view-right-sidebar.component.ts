import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameActionBarComponent } from '@app/components/game/game-action-bar/game-action-bar.component';
import { GameChatPanelComponent } from '@app/components/game/game-chat-panel/game-chat-panel.component';
import { GamePlayerListComponent } from '@app/components/game/game-player-list/game-player-list.component';
import { ChatMessage } from '@common/chat/chat.interface';
import { GameLogEntry } from '@common/game/game-log-entry.interface';
import { Player } from '@common/player/player.interface';

type MessageTab = 'chat' | 'journal';
type WinnerKind = 'player' | 'team' | 'none';
type WinnerTeamId = 'A' | 'B' | null;

@Component({
  selector: 'app-game-view-right-sidebar',
  standalone: true,
  imports: [CommonModule, GamePlayerListComponent, GameChatPanelComponent, GameActionBarComponent],
  templateUrl: './game-view-right-sidebar.component.html',
  styleUrl: './game-view-right-sidebar.component.scss',
})
export class GameViewRightSidebarComponent {
  @Input() players: readonly Player[] = [];
  @Input() turnOrder: readonly string[] = [];
  @Input() activePlayerId = '';
  @Input() currentPlayerId = '';
  @Input() maxPlayers = 0;
  @Input() expanded = false;
  @Input() winnerKind: WinnerKind = 'none';
  @Input() winnerTeamId: WinnerTeamId = null;
  @Input() messageTab: MessageTab = 'chat';
  @Input() journalAvailable = false;
  @Input() chatMessages: readonly ChatMessage[] = [];
  @Input() journalEntries: readonly GameLogEntry[] = [];
  @Input() currentPlayerName: string | null = null;
  @Input() messageMaxLength = 200;
  @Input() actionModeEnabled = false;
  @Input() canAct = false;
  @Input() canEndTurn = false;
  @Input() canUseActionMode = false;

  @Output() togglePlayerListExpanded = new EventEmitter<void>();
  @Output() messageTabChange = new EventEmitter<MessageTab>();
  @Output() chatMessageSubmit = new EventEmitter<string>();
  @Output() endTurn = new EventEmitter<void>();
  @Output() toggleActionMode = new EventEmitter<void>();
  @Output() surrender = new EventEmitter<void>();

  protected onTogglePlayerListExpanded(): void {
    this.togglePlayerListExpanded.emit();
  }

  protected onMessageTabChange(tab: MessageTab): void {
    this.messageTabChange.emit(tab);
  }
}