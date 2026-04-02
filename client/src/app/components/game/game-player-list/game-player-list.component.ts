import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Player, PlayerStatus } from '@common/player/player.interface';
import { getTeamClass } from '../team-class.util';

const COLLAPSED_VISIBLE_ROWS = 2;
const PLAYER_ROW_HEIGHT_PX = 46;
const PLAYER_ROW_GAP_PX = 6;
const PLAYER_ROW_STEP_PX = PLAYER_ROW_HEIGHT_PX + PLAYER_ROW_GAP_PX;

interface PlayerRowView {
  key: string;
  player: Player | null;
  listIndex: number | null;
}

@Component({
  selector: 'app-game-player-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-player-list.component.html',
  styleUrl: './game-player-list.component.scss',
})
export class GamePlayerListComponent {
  @Input({ required: true }) players: readonly Player[] = [];
  @Input({ required: true }) turnOrder: readonly string[] = [];
  @Input() activePlayerId = '';
  @Input() currentPlayerId = '';
  @Input() winnerKind: 'player' | 'team' | 'none' = 'none';
  @Input() winnerTeamId: 'A' | 'B' | null = null;
  @Input() maxPlayers = 0;
  @Input() expanded = false;

  readonly playerStatus = PlayerStatus;

  // Expose currently displayed rows based on expansion state.
  get displayedRows(): readonly PlayerRowView[] {
    return this.expandedRows;
  }

  // Calculate viewport height based on number of visible rows and row dimensions.
  get viewportHeightPx(): number {
    const rows = this.displayedRows;
    const rowCount = this.expanded ? rows.length : Math.min(rows.length, COLLAPSED_VISIBLE_ROWS);
    if (rowCount <= 0) return 0;
    return rowCount * PLAYER_ROW_HEIGHT_PX + Math.max(0, rowCount - 1) * PLAYER_ROW_GAP_PX;
  }

  // Calculate scroll offset to keep active player visible when collapsed.
  get scrollOffsetPx(): number {
    if (this.expanded) {
      return 0;
    }
    // When collapsed, scroll so that active player is visible within the limited rows.
    const rows = this.displayedRows;
    if (rows.length === 0) {
      return 0;
    }
    // Find index of active player or fallback to top if not found.
    let activeIndex = rows.findIndex((row) => row.player?.id === this.activePlayerId);
    if (activeIndex < 0) {
      activeIndex = 0;
    }
    // Calculate max scroll index to prevent scrolling beyond available rows.
    const maxScrollIndex = Math.max(0, rows.length - COLLAPSED_VISIBLE_ROWS);
    activeIndex = Math.min(activeIndex, maxScrollIndex);
    // Scroll offset is negative of active index times row step to move list up.
    return -(activeIndex * PLAYER_ROW_STEP_PX);
  }

  // Helper to identify if a row corresponds to the active player for styling.
  isRowActive(row: PlayerRowView): boolean {
    return row.player?.id === this.activePlayerId;
  }

  isWinningTeamPlayer(row: PlayerRowView): boolean {
    return this.winnerKind === 'team' &&
      !!row.player &&
      row.player.information.teamId !== null &&
      row.player.information.teamId === this.winnerTeamId;
  }

  getTeamClass(teamId: string | null | undefined): string | null {
    return getTeamClass(teamId, 'player--team-');
  }

  getTeamBadgeClass(teamId: string | null | undefined): string | null {
    return getTeamClass(teamId, 'player__badge--team-');
  }

  // Helper to identify if a row corresponds to the current player for styling.
  private get orderedPlayers(): readonly Player[] {
    if (this.turnOrder.length === 0) {
      return [...this.players];
    }

    const playerById = new Map(this.players.map((player) => [player.id, player]));
    return this.turnOrder
      .map((id) => playerById.get(id))
      .filter((player): player is Player => Boolean(player));
  }

  // Build the list of rows to display based on ordered players and expansion state, filling placeholders as needed.
  private get expandedRows(): readonly PlayerRowView[] {
    const rows: PlayerRowView[] = this.orderedPlayers.map((player, index) => ({
      key: `player:${player.id}`,
      player,
      listIndex: index + 1,
    }));

    const placeholders = this.getPlaceholderRows(Math.max(0, this.maxPlayers - rows.length));
    return [...rows, ...placeholders];
  }

  // Helper to generate placeholder rows for empty player slots up to maxPlayers.
  private getPlaceholderRows(count: number): PlayerRowView[] {
    return Array.from({ length: count }, (_, index) => ({
      key: `placeholder:${index}`,
      player: null,
      listIndex: null,
    }));
  }
}
