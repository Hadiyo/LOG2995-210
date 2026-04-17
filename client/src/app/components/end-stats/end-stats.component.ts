import { Component, OnInit, output } from '@angular/core';
import { EndStatsService } from '@app/services/end-stats/end-stats.service';
import { EndStats, PlayerStats } from '@common/game-session';

const CONVERT_TO_PERCENTAGE = 100;
const CONVERT_TO_SECONDS = 1000;
const CONVERT_TO_MINUTES = 60;

@Component({
  selector: 'app-end-stats',
  imports: [],
  templateUrl: './end-stats.component.html',
  styleUrl: './end-stats.component.scss',
})
export class EndStatsComponent implements OnInit {
  constructor(private readonly endStatsService : EndStatsService) {}

  protected endStats: EndStats;

  protected turns: number;
  protected playerStats: PlayerStats[] = [];
  protected durationMinute: string = '00';
  protected durationSecond: string = '00';
  protected percentSanctuary: string = '0';
  protected percentDoor: string = '0';
  protected percentTiles: string = '0';
  protected heldFlag: string[] | undefined = undefined;

  protected sortField: keyof PlayerStats | null = null;
  protected sortDescending = true;

  onEmptyStats = output<void>();

  ngOnInit() {
    this.endStats = this.endStatsService.endStats;

    if (this.endStats) {
      this.turns = this.endStats.turns;
      this.playerStats = this.endStats.playerStats;
      this.percentSanctuary = this.endStats.totalSanctuaries
        ? (this.endStats.usedSanctuaries.length / this.endStats.totalSanctuaries * CONVERT_TO_PERCENTAGE).toFixed(2)
        : '0';
      this.percentDoor = this.endStats.totalDoors 
        ? (this.endStats.usedDoors.length / this.endStats.totalDoors * CONVERT_TO_PERCENTAGE).toFixed(2)
        : '0';
      this.percentTiles = this.endStats.totalTiles 
        ? (this.endStats.visitedTiles.length / this.endStats.totalTiles * CONVERT_TO_PERCENTAGE).toFixed(2)
        : '0';
      this.heldFlag = this.endStats.heldFlag;

      if (this.endStats.endTime) {
        const start = new Date(this.endStats.startTime).getTime();
        const end = new Date(this.endStats.endTime).getTime();
        this.durationMinute = Math.floor((end - start) / CONVERT_TO_SECONDS / CONVERT_TO_MINUTES).toString().padStart(2, '0');
        this.durationSecond = Math.floor((end - start) / CONVERT_TO_SECONDS % CONVERT_TO_MINUTES).toString().padStart(2, '0');
      }
    } else {
      this.onEmptyStats.emit();
    }

    for (const player of this.playerStats) {
      player.percentTiles = parseFloat(this.percentageTilePerPlayer(player));
    }
  }

  percentageTilePerPlayer(player: PlayerStats): string {
    return (this.endStats.visitedTiles.filter(tile => tile.players.includes(player.id)).length 
      / this.endStats.totalTiles * CONVERT_TO_PERCENTAGE).toFixed(2);
  }

  sortPlayers(field: keyof PlayerStats): void {
    if (this.sortField === field) {
      this.sortDescending = !this.sortDescending;
    } else {
      this.sortField = field;
      this.sortDescending = true;
    }

    this.playerStats.sort((a, b) => {
      const valueA = a[field];
      const valueB = b[field];

      if (valueA < valueB) return this.sortDescending ? 1 : -1;
      if (valueA > valueB) return this.sortDescending ? -1 : 1;
      return 0;
    });
  }

  isSorted(field: keyof PlayerStats): boolean {
    return this.sortField === field;  
  }
}
