import { Component, OnInit } from '@angular/core';
import { EndStatsService } from '@app/services/end-stats/end-stats.service';
import { EndStats, PlayerStats } from '@common/game-session';

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

  protected sortField: keyof PlayerStats | null = null;
  protected sortDescending = true;

  ngOnInit() {
    this.endStats = this.endStatsService.endStats;

    if (this.endStats) {
      this.turns = this.endStats.turns;
      this.playerStats = this.endStats.playerStats;
      this.percentSanctuary = this.endStats.totalSanctuaries
        ? (this.endStats.usedSanctuaries.length / this.endStats.totalSanctuaries * 100).toFixed(2)
        : '0';
      this.percentDoor = this.endStats.totalDoors 
        ? (this.endStats.usedDoors.length / this.endStats.totalDoors * 100).toFixed(2)
        : '0';
      this.percentTiles = this.endStats.totalTiles 
        ? (this.endStats.visitedTiles.length / this.endStats.totalTiles * 100).toFixed(2)
        : '0';

      if (this.endStats.endTime) {
        const start = new Date(this.endStats.startTime).getTime();
        const end = new Date(this.endStats.endTime).getTime();
        this.durationMinute = Math.floor((end - start) / 1000 / 60).toString().padStart(2, '0');
        this.durationSecond = Math.floor((end - start) / 1000 % 60).toString().padStart(2, '0');
      }
    }

    for (let player of this.playerStats) {
      player.percentTiles = parseFloat(this.percentageTilePerPlayer(player));
    }
  }

  percentageTilePerPlayer(player: PlayerStats): string {
    return (this.endStats.visitedTiles.filter(tile => tile.players.includes(player.id)).length 
      / this.endStats.totalTiles * 100).toFixed(2);
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

}
