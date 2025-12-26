/**
 * Arena - Tournament management for AI Battleship matches
 */

import chalk from 'chalk';
import { GamePlayer } from '../game/Game.js';
import { PlayerType, GameRecord } from '../game/types.js';
import { Match, MatchOptions, MatchResult } from './Match.js';
import { Scoreboard } from './Scoreboard.js';
import { Colors, Box, horizontalLine, Emoji } from '../ui/colors.js';

export type TournamentMode = 'round-robin' | 'best-of' | 'elimination';

export interface TournamentOptions extends MatchOptions {
  mode?: TournamentMode;
  rounds?: number;        // For round-robin
  bestOf?: number;        // For best-of series
  shufflePairings?: boolean;
  saveReplays?: boolean;
}

export interface TournamentResult {
  mode: TournamentMode;
  matches: MatchResult[];
  scoreboard: Scoreboard;
  champion?: PlayerType;
  duration: number;
}

export class Arena {
  private players: GamePlayer[] = [];
  private scoreboard: Scoreboard | null = null;
  private options: TournamentOptions;
  private gameRecords: GameRecord[] = [];

  constructor(options: TournamentOptions = {}) {
    this.options = {
      mode: 'round-robin',
      rounds: 1,
      bestOf: 3,
      shufflePairings: true,
      saveReplays: true,
      ...options,
    };
  }

  /**
   * Add a player to the arena
   */
  addPlayer(player: GamePlayer): void {
    this.players.push(player);
  }

  /**
   * Remove all players
   */
  clearPlayers(): void {
    this.players = [];
  }

  /**
   * Run a tournament with all registered players
   */
  async runTournament(): Promise<TournamentResult> {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players for a tournament');
    }

    const startTime = Date.now();
    const matches: MatchResult[] = [];

    // Initialize scoreboard
    this.scoreboard = new Scoreboard(
      this.players.map(p => ({ type: p.type, name: p.name }))
    );

    // Print tournament header
    this.printHeader();

    switch (this.options.mode) {
      case 'round-robin':
        await this.runRoundRobin(matches);
        break;
      case 'best-of':
        await this.runBestOf(matches);
        break;
      case 'elimination':
        await this.runElimination(matches);
        break;
    }

    const duration = Date.now() - startTime;

    // Print final results
    this.printResults();

    // Determine champion
    const leaderboard = this.scoreboard.getLeaderboard();
    const champion = leaderboard[0]?.wins > 0 ? leaderboard[0].type : undefined;

    return {
      mode: this.options.mode!,
      matches,
      scoreboard: this.scoreboard,
      champion,
      duration,
    };
  }

  /**
   * Run a single match between two players
   */
  async runMatch(player1: GamePlayer, player2: GamePlayer): Promise<MatchResult> {
    const match = new Match(this.options);
    const result = await match.play(player1, player2);

    if (this.scoreboard) {
      this.scoreboard.recordMatch(
        result.winner,
        result.loser,
        result.turns,
        result.duration,
        result.record
      );
    }

    if (this.options.saveReplays) {
      this.gameRecords.push(result.record);
    }

    return result;
  }

  /**
   * Round-robin tournament - everyone plays everyone
   */
  private async runRoundRobin(matches: MatchResult[]): Promise<void> {
    const pairings = this.generateRoundRobinPairings();
    const totalMatches = pairings.length * (this.options.rounds || 1);

    console.log(chalk.cyan(`\nRound-Robin Tournament: ${this.players.length} players, ${this.options.rounds} round(s)`));
    console.log(chalk.gray(`Total matches: ${totalMatches}\n`));

    let matchNum = 0;
    for (let round = 1; round <= (this.options.rounds || 1); round++) {
      console.log(Colors.header(`\n=== ROUND ${round} ===\n`));

      // Shuffle pairings each round if enabled
      const roundPairings = this.options.shufflePairings
        ? this.shuffle([...pairings])
        : pairings;

      for (const [p1, p2] of roundPairings) {
        matchNum++;
        console.log(chalk.gray(`\nMatch ${matchNum}/${totalMatches}: ${p1.name} vs ${p2.name}`));

        const result = await this.runMatch(p1, p2);
        matches.push(result);

        // Show quick result
        console.log(Colors.success(`  Winner: ${result.winner} in ${result.turns} turns`));

        // Brief delay between matches
        await this.delay(1000);
      }

      // Show standings after each round
      console.log('\n');
      this.scoreboard?.print();
    }
  }

  /**
   * Best-of series between two players
   */
  private async runBestOf(matches: MatchResult[]): Promise<void> {
    if (this.players.length !== 2) {
      throw new Error('Best-of mode requires exactly 2 players');
    }

    const [p1, p2] = this.players;
    const winsNeeded = Math.ceil((this.options.bestOf || 3) / 2);

    console.log(chalk.cyan(`\nBest-of-${this.options.bestOf} Series`));
    console.log(chalk.gray(`${p1.name} vs ${p2.name}`));
    console.log(chalk.gray(`First to ${winsNeeded} wins!\n`));

    let p1Wins = 0;
    let p2Wins = 0;
    let gameNum = 0;

    while (p1Wins < winsNeeded && p2Wins < winsNeeded) {
      gameNum++;
      console.log(Colors.header(`\n=== GAME ${gameNum} ===`));
      console.log(chalk.gray(`Score: ${p1.name} ${p1Wins} - ${p2Wins} ${p2.name}\n`));

      const result = await this.runMatch(p1, p2);
      matches.push(result);

      if (result.winner === p1.type) {
        p1Wins++;
      } else {
        p2Wins++;
      }

      console.log(Colors.success(`  ${result.winner} wins Game ${gameNum}!`));

      await this.delay(1000);
    }

    const seriesWinner = p1Wins > p2Wins ? p1 : p2;
    console.log(Colors.title(`\n${Emoji.trophy} ${seriesWinner.name} WINS THE SERIES ${p1Wins}-${p2Wins}! ${Emoji.trophy}\n`));
  }

  /**
   * Single elimination tournament
   */
  private async runElimination(matches: MatchResult[]): Promise<void> {
    let remaining = [...this.players];

    if (remaining.length < 2) {
      throw new Error('Need at least 2 players for elimination');
    }

    // Shuffle initial bracket
    if (this.options.shufflePairings) {
      remaining = this.shuffle(remaining);
    }

    console.log(chalk.cyan(`\nSingle Elimination Tournament: ${remaining.length} players`));

    let roundNum = 0;
    while (remaining.length > 1) {
      roundNum++;
      const roundName = remaining.length === 2 ? 'FINALS' :
                        remaining.length === 4 ? 'SEMI-FINALS' :
                        `ROUND ${roundNum}`;

      console.log(Colors.header(`\n=== ${roundName} ===\n`));

      const winners: GamePlayer[] = [];

      // Handle odd number of players (bye)
      if (remaining.length % 2 !== 0) {
        const byePlayer = remaining.pop()!;
        winners.push(byePlayer);
        console.log(chalk.gray(`${byePlayer.name} receives a BYE`));
      }

      // Play matches
      for (let i = 0; i < remaining.length; i += 2) {
        const p1 = remaining[i];
        const p2 = remaining[i + 1];

        console.log(chalk.gray(`\n${p1.name} vs ${p2.name}`));

        const result = await this.runMatch(p1, p2);
        matches.push(result);

        const winner = this.players.find(p => p.type === result.winner)!;
        winners.push(winner);

        console.log(Colors.success(`  ${winner.name} advances!`));

        await this.delay(1000);
      }

      remaining = winners;
    }

    console.log(Colors.title(`\n${Emoji.trophy} CHAMPION: ${remaining[0].name}! ${Emoji.trophy}\n`));
  }

  /**
   * Generate round-robin pairings
   */
  private generateRoundRobinPairings(): [GamePlayer, GamePlayer][] {
    const pairings: [GamePlayer, GamePlayer][] = [];

    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        pairings.push([this.players[i], this.players[j]]);
      }
    }

    return pairings;
  }

  /**
   * Shuffle an array
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Print tournament header
   */
  private printHeader(): void {
    const width = 50;
    console.log('\n' + Colors.border(Box.topLeft + horizontalLine(width - 2) + Box.topRight));
    const title = `${Emoji.anchor} AI BATTLESHIP ARENA ${Emoji.anchor}`;
    const titlePad = Math.floor((width - title.length) / 2);
    console.log(Colors.border(Box.vertical) + ' '.repeat(titlePad) + Colors.title(title) + ' '.repeat(width - titlePad - title.length - 2) + Colors.border(Box.vertical));
    console.log(Colors.border(Box.bottomLeft + horizontalLine(width - 2) + Box.bottomRight));

    console.log(chalk.gray('\nPlayers:'));
    for (const player of this.players) {
      console.log(chalk.gray(`  - ${player.name}`));
    }
  }

  /**
   * Print final results
   */
  private printResults(): void {
    console.log(Colors.header('\n=== FINAL RESULTS ===\n'));
    this.scoreboard?.print();
  }

  /**
   * Get all game records (for replay)
   */
  getGameRecords(): GameRecord[] {
    return [...this.gameRecords];
  }

  /**
   * Helper delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
