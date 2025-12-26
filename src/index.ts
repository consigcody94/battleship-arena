#!/usr/bin/env node

/**
 * AI Battleship Arena - CLI Entry Point
 *
 * Watch AI-powered CLI tools battle it out in classic Battleship!
 * Supports Claude CLI, Gemini CLI, and Codex CLI.
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import { ClaudePlayer } from './ai/ClaudePlayer.js';
import { GeminiPlayer } from './ai/GeminiPlayer.js';
import { CodexPlayer } from './ai/CodexPlayer.js';
import { GamePlayer } from './game/Game.js';
import { Arena, TournamentMode } from './arena/Arena.js';
import { Match } from './arena/Match.js';
import { Colors, Emoji, Box, horizontalLine } from './ui/colors.js';
import { PlayerType } from './game/types.js';

// Version and description
program
  .name('battleship-arena')
  .description('AI Battleship Arena - Watch AI CLI tools battle it out!')
  .version('1.0.0');

/**
 * Create a player instance based on type
 */
function createPlayer(type: string, options: { model?: string; timeout?: number } = {}): GamePlayer {
  switch (type.toLowerCase()) {
    case 'claude':
      return new ClaudePlayer(options);
    case 'gemini':
      return new GeminiPlayer(options);
    case 'codex':
      return new CodexPlayer(options);
    default:
      throw new Error(`Unknown player type: ${type}. Use 'claude', 'gemini', or 'codex'.`);
  }
}

/**
 * Check which AI CLIs are available
 */
async function checkAvailablePlayers(): Promise<{ claude: boolean; gemini: boolean; codex: boolean }> {
  const spinner = ora('Checking available AI CLIs...').start();

  const [claude, gemini, codex] = await Promise.all([
    ClaudePlayer.isAvailable(),
    GeminiPlayer.isAvailable(),
    CodexPlayer.isAvailable(),
  ]);

  spinner.stop();
  return { claude, gemini, codex };
}

/**
 * Print the banner
 */
function printBanner(): void {
  console.log('');
  console.log(Colors.border(Box.topLeft + horizontalLine(50) + Box.topRight));
  console.log(Colors.border(Box.vertical) + '                                                  ' + Colors.border(Box.vertical));
  console.log(Colors.border(Box.vertical) + Colors.title(`       ${Emoji.anchor} AI BATTLESHIP ARENA ${Emoji.anchor}        `) + Colors.border(Box.vertical));
  console.log(Colors.border(Box.vertical) + chalk.gray('       Claude vs Gemini vs Codex              ') + Colors.border(Box.vertical));
  console.log(Colors.border(Box.vertical) + '                                                  ' + Colors.border(Box.vertical));
  console.log(Colors.border(Box.bottomLeft + horizontalLine(50) + Box.bottomRight));
  console.log('');
}

// Main command - interactive mode
program
  .command('play', { isDefault: true })
  .description('Start an interactive match or tournament')
  .action(async () => {
    printBanner();

    const available = await checkAvailablePlayers();

    console.log(chalk.cyan('Available AI Players:'));
    console.log(`  ${available.claude ? chalk.green('✓') : chalk.red('✗')} Claude CLI ${available.claude ? '' : chalk.gray('(not installed)')}`);
    console.log(`  ${available.gemini ? chalk.green('✓') : chalk.red('✗')} Gemini CLI ${available.gemini ? '' : chalk.gray('(not installed)')}`);
    console.log(`  ${available.codex ? chalk.green('✓') : chalk.red('✗')} Codex CLI ${available.codex ? '' : chalk.gray('(not installed)')}`);
    console.log('');

    const availableCount = [available.claude, available.gemini, available.codex].filter(Boolean).length;

    if (availableCount < 2) {
      console.log(chalk.yellow('Need at least 2 AI CLIs installed to play.'));
      console.log(chalk.gray('\nInstall them with:'));
      console.log(chalk.gray('  Claude: npm install -g @anthropic-ai/claude-code'));
      console.log(chalk.gray('  Gemini: npm install -g @google/gemini-cli'));
      console.log(chalk.gray('  Codex:  npm install -g @openai/codex'));
      process.exit(1);
    }

    console.log(chalk.cyan('Use one of the following commands:'));
    console.log(chalk.gray('  battleship-arena match --p1 claude --p2 gemini'));
    console.log(chalk.gray('  battleship-arena tournament --players claude,gemini,codex'));
    console.log(chalk.gray('  battleship-arena --help'));
  });

// Quick match between two players
program
  .command('match')
  .description('Play a single match between two AI players')
  .requiredOption('--p1 <player>', 'First player (claude, gemini, or codex)')
  .requiredOption('--p2 <player>', 'Second player (claude, gemini, or codex)')
  .option('--delay <ms>', 'Delay between turns in milliseconds', '500')
  .option('--no-emoji', 'Disable emoji in output')
  .option('--save <file>', 'Save game replay to file')
  .action(async (options) => {
    printBanner();

    try {
      const player1 = createPlayer(options.p1);
      const player2 = createPlayer(options.p2);

      console.log(chalk.cyan(`Starting match: ${player1.name} vs ${player2.name}\n`));

      const match = new Match({
        delayBetweenTurns: parseInt(options.delay),
        showEmoji: options.emoji !== false,
        verbose: true,
      });

      const result = await match.play(player1, player2);

      console.log(chalk.green(`\nMatch complete! ${result.winner} wins in ${result.turns} turns.`));

      // Save replay if requested
      if (options.save) {
        const replayData = JSON.stringify(result.record, null, 2);
        writeFileSync(options.save, replayData);
        console.log(chalk.gray(`Replay saved to: ${options.save}`));
      }

    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Tournament mode
program
  .command('tournament')
  .description('Run a tournament with multiple AI players')
  .requiredOption('--players <list>', 'Comma-separated list of players (e.g., claude,gemini,codex)')
  .option('--mode <mode>', 'Tournament mode: round-robin, best-of, elimination', 'round-robin')
  .option('--rounds <n>', 'Number of rounds (for round-robin)', '1')
  .option('--best-of <n>', 'Best of N games (for best-of mode)', '3')
  .option('--delay <ms>', 'Delay between turns', '500')
  .option('--no-emoji', 'Disable emoji')
  .option('--save-dir <dir>', 'Directory to save replays')
  .action(async (options) => {
    printBanner();

    try {
      const playerTypes = options.players.split(',').map((p: string) => p.trim().toLowerCase());

      if (playerTypes.length < 2) {
        throw new Error('Need at least 2 players for a tournament');
      }

      const arena = new Arena({
        mode: options.mode as TournamentMode,
        rounds: parseInt(options.rounds),
        bestOf: parseInt(options.bestOf),
        delayBetweenTurns: parseInt(options.delay),
        showEmoji: options.emoji !== false,
        saveReplays: !!options.saveDir,
      });

      for (const type of playerTypes) {
        arena.addPlayer(createPlayer(type));
      }

      const result = await arena.runTournament();

      if (result.champion) {
        console.log(chalk.green(`\n${Emoji.trophy} Tournament Champion: ${result.champion}! ${Emoji.trophy}`));
      }

      console.log(chalk.gray(`\nTotal duration: ${(result.duration / 1000).toFixed(1)}s`));

      // Save replays if requested
      if (options.saveDir) {
        const dir = options.saveDir;
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const records = arena.getGameRecords();
        for (let i = 0; i < records.length; i++) {
          const filename = join(dir, `game-${i + 1}.json`);
          writeFileSync(filename, JSON.stringify(records[i], null, 2));
        }
        console.log(chalk.gray(`Replays saved to: ${dir}/`));
      }

    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Check available CLIs
program
  .command('check')
  .description('Check which AI CLIs are installed and available')
  .action(async () => {
    printBanner();

    console.log(chalk.cyan('Checking AI CLI availability...\n'));

    const spinner = ora('Testing Claude CLI...').start();
    const claudeAvailable = await ClaudePlayer.isAvailable();
    spinner.stop();
    console.log(`  Claude CLI: ${claudeAvailable ? chalk.green('✓ Available') : chalk.red('✗ Not found')}`);

    spinner.start('Testing Gemini CLI...');
    const geminiAvailable = await GeminiPlayer.isAvailable();
    spinner.stop();
    console.log(`  Gemini CLI: ${geminiAvailable ? chalk.green('✓ Available') : chalk.red('✗ Not found')}`);

    spinner.start('Testing Codex CLI...');
    const codexAvailable = await CodexPlayer.isAvailable();
    spinner.stop();
    console.log(`  Codex CLI:  ${codexAvailable ? chalk.green('✓ Available') : chalk.red('✗ Not found')}`);

    console.log('');

    const available = [claudeAvailable, geminiAvailable, codexAvailable].filter(Boolean).length;
    if (available >= 2) {
      console.log(chalk.green(`${available} AI CLIs available - ready to battle!`));
    } else if (available === 1) {
      console.log(chalk.yellow('Only 1 AI CLI available. Install at least one more to play.'));
    } else {
      console.log(chalk.red('No AI CLIs found. Please install at least 2 to play.'));
    }

    console.log(chalk.gray('\nInstallation commands:'));
    console.log(chalk.gray('  Claude: npm install -g @anthropic-ai/claude-code'));
    console.log(chalk.gray('  Gemini: npm install -g @google/gemini-cli'));
    console.log(chalk.gray('  Codex:  npm install -g @openai/codex'));
  });

// Demo mode - quick visual demonstration
program
  .command('demo')
  .description('Run a quick demo with mock players (no AI CLI required)')
  .action(async () => {
    printBanner();

    console.log(chalk.cyan('Demo mode - using random moves to demonstrate the UI\n'));

    // Create mock players that just make random moves
    const MockPlayer = class implements GamePlayer {
      type: PlayerType;
      name: string;
      private moveHistory: { coord: { row: number; col: number }; result: 'hit' | 'miss' | 'sunk' }[] = [];

      constructor(type: PlayerType, name: string) {
        this.type = type;
        this.name = name;
      }

      async placeShips(): Promise<any[]> {
        return []; // Use random placement
      }

      async getMove(_ownBoard: any, opponentView: any): Promise<{ coordinate: { row: number; col: number }; reasoning?: string }> {
        // Include hits, misses, AND sunk cells (from moveHistory)
        const firedAt = new Set([
          ...opponentView.hits.map((c: any) => `${c.row},${c.col}`),
          ...opponentView.misses.map((c: any) => `${c.row},${c.col}`),
          ...this.moveHistory.map((m: any) => `${m.coord.row},${m.coord.col}`),
        ]);

        const available: { row: number; col: number }[] = [];
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 10; col++) {
            if (!firedAt.has(`${row},${col}`)) {
              available.push({ row, col });
            }
          }
        }

        const coord = available[Math.floor(Math.random() * available.length)];
        const reasonings = [
          'Checking this quadrant systematically',
          'Following up on previous pattern',
          'Random probe in unexplored area',
          'Targeting high-probability zone',
          'Testing checkerboard pattern',
        ];

        return {
          coordinate: coord,
          reasoning: reasonings[Math.floor(Math.random() * reasonings.length)],
        };
      }

      notifyResult(result: any): void {
        this.moveHistory.push({ coord: result.coordinate, result: result.result });
      }

      notifyOpponentMove(): void {}
    };

    const player1 = new MockPlayer('claude', 'Claude (Demo)');
    const player2 = new MockPlayer('gemini', 'Gemini (Demo)');

    const match = new Match({
      delayBetweenTurns: 300,
      showEmoji: true,
      verbose: true,
    });

    const result = await match.play(player1, player2);

    console.log(chalk.green(`\nDemo complete! ${result.winner} wins in ${result.turns} turns.`));
    console.log(chalk.gray('\nTo play with real AI CLIs, run:'));
    console.log(chalk.gray('  battleship-arena match --p1 claude --p2 gemini'));
  });

// Parse and run
program.parse();
