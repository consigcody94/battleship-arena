/**
 * MatchDisplay - Full match visualization with both boards and game info
 */

import chalk from 'chalk';
import { Board } from '../game/Board.js';
import { Game, GamePlayer } from '../game/Game.js';
import {
  PlayerType,
  TurnRecord,
  GameState,
  SHIP_TYPES,
  coordToString,
} from '../game/types.js';
import { BoardRenderer } from './BoardRenderer.js';
import { Colors, Box, Emoji, horizontalLine, healthBar } from './colors.js';

export interface DisplayOptions {
  width?: number;
  showEmoji?: boolean;
  clearScreen?: boolean;
}

export class MatchDisplay {
  private width: number;
  private showEmoji: boolean;

  constructor(options: DisplayOptions = {}) {
    this.width = options.width || 80;
    this.showEmoji = options.showEmoji !== false;
  }

  /**
   * Clear the screen
   */
  clear(): void {
    console.clear();
    // Move cursor to top
    process.stdout.write('\x1B[0;0H');
  }

  /**
   * Render the full match display
   */
  render(
    game: Game,
    players: [GamePlayer, GamePlayer],
    lastTurn?: TurnRecord,
    thinking?: { player: PlayerType; message: string }
  ): void {
    const state = game.getState();
    const lines: string[] = [];

    // Header
    lines.push(...this.renderHeader());

    // Player info bar
    lines.push(...this.renderPlayerBar(state, players));

    // Separator
    lines.push(Colors.border(Box.teeRight + horizontalLine(this.width - 2) + Box.teeLeft));

    // Boards section
    const boardLines = this.renderBoards(game, players, state.currentTurn);
    lines.push(...boardLines);

    // Separator
    lines.push(Colors.border(Box.teeRight + horizontalLine(this.width - 2) + Box.teeLeft));

    // Status section
    lines.push(...this.renderStatus(state, lastTurn, thinking));

    // Bottom border
    lines.push(Colors.border(Box.bottomLeft + horizontalLine(this.width - 2) + Box.bottomRight));

    // Legend
    lines.push('');
    lines.push(...BoardRenderer.renderLegend());

    // Output everything
    console.log(lines.join('\n'));
  }

  /**
   * Render the header
   */
  private renderHeader(): string[] {
    const title = this.showEmoji
      ? `${Emoji.anchor} AI BATTLESHIP ARENA ${Emoji.anchor}`
      : '=== AI BATTLESHIP ARENA ===';

    const padding = Math.floor((this.width - title.length - 2) / 2);

    return [
      Colors.border(Box.topLeft + horizontalLine(this.width - 2) + Box.topRight),
      Colors.border(Box.vertical) +
        ' '.repeat(Math.max(0, padding)) +
        Colors.title(title) +
        ' '.repeat(Math.max(0, this.width - padding - title.length - 2)) +
        Colors.border(Box.vertical),
    ];
  }

  /**
   * Render the player information bar
   */
  private renderPlayerBar(state: GameState, players: [GamePlayer, GamePlayer]): string[] {
    const p1 = state.players[0];
    const p2 = state.players[1];

    const p1Ships = healthBar(p1.shipsRemaining, 5, 5);
    const p2Ships = healthBar(p2.shipsRemaining, 5, 5);

    const p1Name = state.currentTurn === p1.type
      ? Colors.currentTurn(` ${p1.name} `)
      : Colors.player1(p1.name);

    const p2Name = state.currentTurn === p2.type
      ? Colors.currentTurn(` ${p2.name} `)
      : Colors.player2(p2.name);

    const leftPart = `  ${p1Name}  Ships: ${p1Ships} ${p1.shipsRemaining}/5`;
    const rightPart = `Ships: ${p2Ships} ${p2.shipsRemaining}/5  ${p2Name}  `;

    // Calculate spacing
    const leftLen = this.stripAnsi(leftPart).length;
    const rightLen = this.stripAnsi(rightPart).length;
    const middleSpace = Math.max(1, this.width - leftLen - rightLen - 4);

    const vs = Colors.subtitle(' vs ');

    return [
      Colors.border(Box.teeRight + horizontalLine(this.width - 2) + Box.teeLeft),
      Colors.border(Box.vertical) + leftPart + ' '.repeat(middleSpace) + vs + rightPart + Colors.border(Box.vertical),
    ];
  }

  /**
   * Render both boards side by side
   */
  private renderBoards(
    game: Game,
    players: [GamePlayer, GamePlayer],
    currentTurn: PlayerType
  ): string[] {
    const p1Type = players[0].type;
    const p2Type = players[1].type;

    const p1Board = game.getBoard(p1Type)!;
    const p2Board = game.getBoard(p2Type)!;

    // For each player, show their fleet and their attacks
    // Player 1's view: own fleet (left) + attacks on p2 (right as tracking)
    // We'll show P1's perspective

    const p1OwnTitle = `${players[0].name}'s Fleet`;
    const p1AttackTitle = `${players[0].name}'s Attacks`;

    // Render player 1's own board (showing ships)
    const p1OwnLines = BoardRenderer.render(p1Board, {
      showShips: true,
      title: p1OwnTitle,
    });

    // Render player 1's view of player 2's board (tracking)
    const p1TrackingLines = BoardRenderer.renderTrackingBoard(
      p2Board.cloneForOpponent(),
      p1AttackTitle
    );

    // Combine side by side
    const boardWidth = 23; // Approximate width of a board
    const gap = 4;
    const lines: string[] = [];

    const maxLines = Math.max(p1OwnLines.length, p1TrackingLines.length);
    for (let i = 0; i < maxLines; i++) {
      const left = p1OwnLines[i] || '';
      const right = p1TrackingLines[i] || '';

      const leftPadded = left + ' '.repeat(Math.max(0, boardWidth - this.stripAnsi(left).length));
      const content = '  ' + leftPadded + ' '.repeat(gap) + right;
      const contentLen = this.stripAnsi(content).length;

      lines.push(
        Colors.border(Box.vertical) +
        content +
        ' '.repeat(Math.max(0, this.width - contentLen - 2)) +
        Colors.border(Box.vertical)
      );
    }

    return lines;
  }

  /**
   * Render the status section (turn info, last move, thinking)
   */
  private renderStatus(
    state: GameState,
    lastTurn?: TurnRecord,
    thinking?: { player: PlayerType; message: string }
  ): string[] {
    const lines: string[] = [];

    // Turn counter
    const turnInfo = `TURN ${state.turnNumber}`;
    let statusLine = `  ${Colors.info(turnInfo)}`;

    if (thinking) {
      const icon = this.showEmoji ? Emoji.thinking : '->';
      statusLine += ` ${Colors.border('│')} ${Colors.thinking(`${icon} ${thinking.player.toUpperCase()} thinking: "${thinking.message}"`)}`;
    } else if (state.phase === 'finished' && state.winner) {
      const icon = this.showEmoji ? Emoji.trophy : '***';
      statusLine += ` ${Colors.border('│')} ${Colors.success(`${icon} ${state.winner.toUpperCase()} WINS! ${icon}`)}`;
    }

    lines.push(
      Colors.border(Box.vertical) +
      statusLine +
      ' '.repeat(Math.max(0, this.width - this.stripAnsi(statusLine).length - 2)) +
      Colors.border(Box.vertical)
    );

    // Separator
    lines.push(
      Colors.border(Box.vertical) +
      Colors.border(Box.lightHorizontal.repeat(this.width - 2)) +
      Colors.border(Box.vertical)
    );

    // Last move
    if (lastTurn) {
      const resultText = lastTurn.result.toUpperCase();
      const coloredResult = lastTurn.result === 'miss'
        ? chalk.white(resultText)
        : lastTurn.result === 'sunk'
          ? chalk.red.bold(resultText)
          : chalk.red.bold(resultText);
      const icon = lastTurn.result === 'sunk'
        ? (this.showEmoji ? Emoji.explosion : '!!!')
        : lastTurn.result === 'hit'
          ? (this.showEmoji ? Emoji.fire : '*')
          : '';

      const moveInfo = `  LAST MOVE: ${lastTurn.player.toUpperCase()} fired at ${coordToString(lastTurn.coordinate)} → ${coloredResult} ${icon}`;

      lines.push(
        Colors.border(Box.vertical) +
        moveInfo +
        ' '.repeat(Math.max(0, this.width - this.stripAnsi(moveInfo).length - 2)) +
        Colors.border(Box.vertical)
      );

      // Ship sunk notification
      if (lastTurn.shipSunk) {
        const sunkMsg = `  ${this.showEmoji ? Emoji.skull : '!!!'} ${SHIP_TYPES[lastTurn.shipSunk].name} has been SUNK!`;
        lines.push(
          Colors.border(Box.vertical) +
          Colors.error(sunkMsg) +
          ' '.repeat(Math.max(0, this.width - this.stripAnsi(sunkMsg).length - 2)) +
          Colors.border(Box.vertical)
        );
      }

      // AI reasoning
      if (lastTurn.reasoning) {
        const reasoningMsg = `  ${lastTurn.player.toUpperCase()}: "${lastTurn.reasoning}"`;
        const truncated = reasoningMsg.length > this.width - 4
          ? reasoningMsg.substring(0, this.width - 7) + '...'
          : reasoningMsg;

        lines.push(
          Colors.border(Box.vertical) +
          Colors.thinking(truncated) +
          ' '.repeat(Math.max(0, this.width - this.stripAnsi(truncated).length - 2)) +
          Colors.border(Box.vertical)
        );
      }
    } else {
      const noMoveMsg = '  Waiting for first move...';
      lines.push(
        Colors.border(Box.vertical) +
        Colors.subtitle(noMoveMsg) +
        ' '.repeat(Math.max(0, this.width - noMoveMsg.length - 2)) +
        Colors.border(Box.vertical)
      );
    }

    return lines;
  }

  /**
   * Render game over screen
   */
  renderGameOver(
    winner: PlayerType,
    loser: PlayerType,
    turns: number,
    duration: number
  ): void {
    const lines: string[] = [];

    lines.push('');
    lines.push(Colors.border(Box.topLeft + horizontalLine(this.width - 2) + Box.topRight));

    const trophy = this.showEmoji ? `${Emoji.trophy} ` : '';
    const title = `${trophy}GAME OVER${trophy}`;
    const titlePad = Math.floor((this.width - title.length - 2) / 2);

    lines.push(
      Colors.border(Box.vertical) +
      ' '.repeat(titlePad) +
      Colors.title(title) +
      ' '.repeat(this.width - titlePad - title.length - 2) +
      Colors.border(Box.vertical)
    );

    lines.push(Colors.border(Box.teeRight + horizontalLine(this.width - 2) + Box.teeLeft));

    const winnerLine = `  ${Colors.success('WINNER:')} ${Colors.player1(winner.toUpperCase())}`;
    const turnsLine = `  Total Turns: ${turns}`;
    const durationLine = `  Duration: ${(duration / 1000).toFixed(1)}s`;

    for (const line of [winnerLine, turnsLine, durationLine]) {
      lines.push(
        Colors.border(Box.vertical) +
        line +
        ' '.repeat(Math.max(0, this.width - this.stripAnsi(line).length - 2)) +
        Colors.border(Box.vertical)
      );
    }

    lines.push(Colors.border(Box.bottomLeft + horizontalLine(this.width - 2) + Box.bottomRight));
    lines.push('');

    console.log(lines.join('\n'));
  }

  /**
   * Render a simple message
   */
  message(text: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const colorFn = {
      info: Colors.info,
      success: Colors.success,
      error: Colors.error,
      warning: Colors.warning,
    }[type];

    console.log(colorFn(text));
  }

  /**
   * Strip ANSI codes from string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
