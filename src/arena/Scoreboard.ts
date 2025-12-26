/**
 * Scoreboard - Track wins, losses, and stats across matches
 */

import chalk from 'chalk';
import { PlayerType, GameRecord } from '../game/types.js';
import { Colors, Box, horizontalLine } from '../ui/colors.js';

export interface PlayerStats {
  type: PlayerType;
  name: string;
  wins: number;
  losses: number;
  totalTurns: number;
  totalHits: number;
  totalMisses: number;
  shipsSunk: number;
  shipsLost: number;
  avgTurnsToWin: number;
  winRate: number;
}

export interface MatchRecord {
  player1: PlayerType;
  player2: PlayerType;
  winner: PlayerType;
  turns: number;
  duration: number;
}

export class Scoreboard {
  private stats: Map<PlayerType, PlayerStats> = new Map();
  private matches: MatchRecord[] = [];

  constructor(players: { type: PlayerType; name: string }[]) {
    for (const player of players) {
      this.stats.set(player.type, {
        type: player.type,
        name: player.name,
        wins: 0,
        losses: 0,
        totalTurns: 0,
        totalHits: 0,
        totalMisses: 0,
        shipsSunk: 0,
        shipsLost: 0,
        avgTurnsToWin: 0,
        winRate: 0,
      });
    }
  }

  /**
   * Record a match result
   */
  recordMatch(
    winner: PlayerType,
    loser: PlayerType,
    turns: number,
    duration: number,
    record?: GameRecord
  ): void {
    // Update winner stats
    const winnerStats = this.stats.get(winner)!;
    winnerStats.wins++;
    winnerStats.totalTurns += Math.ceil(turns / 2); // Approximate turns for this player

    // Update loser stats
    const loserStats = this.stats.get(loser)!;
    loserStats.losses++;
    loserStats.totalTurns += Math.floor(turns / 2);

    // Calculate hits/misses from record if available
    if (record) {
      for (const turn of record.turns) {
        const stats = this.stats.get(turn.player)!;
        if (turn.result === 'hit' || turn.result === 'sunk') {
          stats.totalHits++;
        } else {
          stats.totalMisses++;
        }
        if (turn.shipSunk) {
          stats.shipsSunk++;
          const opponent = turn.player === winner ? loser : winner;
          this.stats.get(opponent)!.shipsLost++;
        }
      }
    }

    // Recalculate averages
    for (const stats of this.stats.values()) {
      const totalGames = stats.wins + stats.losses;
      stats.winRate = totalGames > 0 ? (stats.wins / totalGames) * 100 : 0;
      stats.avgTurnsToWin = stats.wins > 0
        ? stats.totalTurns / stats.wins
        : 0;
    }

    // Record match
    this.matches.push({
      player1: winner,
      player2: loser,
      winner,
      turns,
      duration,
    });
  }

  /**
   * Get stats for a specific player
   */
  getPlayerStats(player: PlayerType): PlayerStats | undefined {
    return this.stats.get(player);
  }

  /**
   * Get all player stats sorted by wins
   */
  getLeaderboard(): PlayerStats[] {
    return Array.from(this.stats.values())
      .sort((a, b) => {
        // Sort by wins first, then by win rate
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      });
  }

  /**
   * Get head-to-head record between two players
   */
  getHeadToHead(player1: PlayerType, player2: PlayerType): { player1Wins: number; player2Wins: number } {
    let player1Wins = 0;
    let player2Wins = 0;

    for (const match of this.matches) {
      if ((match.player1 === player1 || match.player2 === player1) &&
          (match.player1 === player2 || match.player2 === player2)) {
        if (match.winner === player1) player1Wins++;
        else if (match.winner === player2) player2Wins++;
      }
    }

    return { player1Wins, player2Wins };
  }

  /**
   * Render the scoreboard as a string
   */
  render(): string[] {
    const lines: string[] = [];
    const width = 70;

    // Header
    lines.push(Colors.border(Box.topLeft + horizontalLine(width - 2) + Box.topRight));
    const title = 'SCOREBOARD';
    const titlePad = Math.floor((width - title.length - 2) / 2);
    lines.push(
      Colors.border(Box.vertical) +
      ' '.repeat(titlePad) +
      Colors.title(title) +
      ' '.repeat(width - titlePad - title.length - 2) +
      Colors.border(Box.vertical)
    );
    lines.push(Colors.border(Box.teeRight + horizontalLine(width - 2) + Box.teeLeft));

    // Column headers
    const headerLine = chalk.gray(
      '  ' +
      'Player'.padEnd(20) +
      'W'.padStart(5) +
      'L'.padStart(5) +
      'Win%'.padStart(8) +
      'Hits'.padStart(8) +
      'Ships'.padStart(8)
    );
    lines.push(Colors.border(Box.vertical) + headerLine + ' '.repeat(width - headerLine.length - 2) + Colors.border(Box.vertical));
    lines.push(Colors.border(Box.vertical) + Colors.border(Box.lightHorizontal.repeat(width - 2)) + Colors.border(Box.vertical));

    // Player rows
    const leaderboard = this.getLeaderboard();
    for (let i = 0; i < leaderboard.length; i++) {
      const stats = leaderboard[i];
      const rank = i === 0 && stats.wins > 0 ? Colors.success('★ ') : '  ';
      const nameColor = i === 0 ? Colors.player1 : i === 1 ? Colors.player2 : chalk.white;

      const rowLine =
        rank +
        nameColor(stats.name.padEnd(18)) +
        chalk.green(stats.wins.toString().padStart(5)) +
        chalk.red(stats.losses.toString().padStart(5)) +
        chalk.yellow(stats.winRate.toFixed(1).padStart(7) + '%') +
        chalk.cyan(stats.totalHits.toString().padStart(8)) +
        chalk.magenta(stats.shipsSunk.toString().padStart(8));

      lines.push(Colors.border(Box.vertical) + rowLine + ' '.repeat(Math.max(0, width - this.stripAnsi(rowLine).length - 2)) + Colors.border(Box.vertical));
    }

    // Footer with total matches
    lines.push(Colors.border(Box.teeRight + horizontalLine(width - 2) + Box.teeLeft));
    const totalLine = `  Total Matches: ${this.matches.length}`;
    lines.push(Colors.border(Box.vertical) + chalk.gray(totalLine) + ' '.repeat(width - totalLine.length - 2) + Colors.border(Box.vertical));

    lines.push(Colors.border(Box.bottomLeft + horizontalLine(width - 2) + Box.bottomRight));

    return lines;
  }

  /**
   * Print the scoreboard to console
   */
  print(): void {
    console.log(this.render().join('\n'));
  }

  /**
   * Strip ANSI codes
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Export stats as JSON
   */
  toJSON(): object {
    return {
      players: Array.from(this.stats.values()),
      matches: this.matches,
      generated: new Date().toISOString(),
    };
  }
}
