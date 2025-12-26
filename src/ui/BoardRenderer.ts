/**
 * BoardRenderer - Renders the Battleship board with colors and styling
 */

import chalk from 'chalk';
import { Board } from '../game/Board.js';
import {
  GRID_SIZE,
  COLUMNS,
  SHIP_TYPES,
  ShipType,
  coordToString,
} from '../game/types.js';
import { Colors, Box, getShipColor, healthBar } from './colors.js';

export interface RenderOptions {
  showShips?: boolean;      // Show ship positions (own board view)
  showCoordinates?: boolean; // Show A-J and 1-10 labels
  highlightCell?: { row: number; col: number }; // Cell to highlight
  title?: string;           // Title above the board
  compact?: boolean;        // Compact mode (no spacing)
}

export class BoardRenderer {
  /**
   * Render a board as an array of strings
   */
  static render(board: Board, options: RenderOptions = {}): string[] {
    const {
      showShips = false,
      showCoordinates = true,
      highlightCell,
      title,
      compact = false,
    } = options;

    const lines: string[] = [];

    // Add title if provided
    if (title) {
      lines.push(Colors.header(title));
    }

    // Column headers
    if (showCoordinates) {
      const spacing = compact ? '' : ' ';
      lines.push(chalk.gray('   ' + COLUMNS.join(spacing)));
    }

    // Render each row
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowNum = showCoordinates
        ? chalk.gray((row + 1).toString().padStart(2, ' ') + ' ')
        : '';

      const cells: string[] = [];

      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = board.getCell({ row, col });
        const isHighlighted = highlightCell?.row === row && highlightCell?.col === col;

        let cellChar: string;

        switch (cell.state) {
          case 'empty':
            cellChar = showShips ? Colors.water : Colors.unknown;
            break;
          case 'ship':
            if (showShips && cell.shipType) {
              cellChar = getShipColor(cell.shipType)(SHIP_TYPES[cell.shipType].symbol);
            } else {
              cellChar = Colors.unknown;
            }
            break;
          case 'hit':
            cellChar = Colors.hit;
            break;
          case 'miss':
            cellChar = Colors.miss;
            break;
          case 'sunk':
            cellChar = Colors.sunk;
            break;
          default:
            cellChar = Colors.unknown;
        }

        if (isHighlighted) {
          cellChar = chalk.bgYellow.black(cellChar);
        }

        cells.push(cellChar);
      }

      const spacing = compact ? '' : ' ';
      lines.push(rowNum + cells.join(spacing));
    }

    return lines;
  }

  /**
   * Render a side-by-side view of two boards
   */
  static renderSideBySide(
    leftBoard: Board,
    rightBoard: Board,
    leftOptions: RenderOptions & { title?: string } = {},
    rightOptions: RenderOptions & { title?: string } = {}
  ): string[] {
    const leftLines = this.render(leftBoard, { ...leftOptions, showCoordinates: true });
    const rightLines = this.render(rightBoard, { ...rightOptions, showCoordinates: true });

    // Calculate widths
    const leftWidth = Math.max(...leftLines.map(l => this.stripAnsi(l).length));
    const gap = 4;

    const combined: string[] = [];

    // Handle different line counts
    const maxLines = Math.max(leftLines.length, rightLines.length);

    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i] || '';
      const rightLine = rightLines[i] || '';

      const leftPadded = leftLine + ' '.repeat(Math.max(0, leftWidth - this.stripAnsi(leftLine).length));
      combined.push(leftPadded + ' '.repeat(gap) + rightLine);
    }

    return combined;
  }

  /**
   * Render the tracking board (opponent's board from our view)
   */
  static renderTrackingBoard(
    opponentView: ReturnType<Board['cloneForOpponent']>,
    title?: string
  ): string[] {
    const lines: string[] = [];

    if (title) {
      lines.push(Colors.header(title));
    }

    // Column headers
    lines.push(chalk.gray('   ' + COLUMNS.join(' ')));

    // Create grid representation
    const grid: string[][] = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(Colors.unknown));

    // Mark hits
    for (const hit of opponentView.hits) {
      grid[hit.row][hit.col] = Colors.hit;
    }

    // Mark misses
    for (const miss of opponentView.misses) {
      grid[miss.row][miss.col] = Colors.miss;
    }

    // Note: sunk ships would need position info to mark as X
    // For simplicity, hits remain as hits until we have full ship position data

    // Render rows
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowNum = chalk.gray((row + 1).toString().padStart(2, ' ') + ' ');
      lines.push(rowNum + grid[row].join(' '));
    }

    return lines;
  }

  /**
   * Render a legend explaining the symbols
   */
  static renderLegend(): string[] {
    return [
      chalk.gray('LEGEND:'),
      `  ${Colors.water} Water    ${Colors.hit} Hit    ${Colors.miss} Miss    ${Colors.sunk} Sunk`,
      `  ${Colors.carrier} Carrier  ${Colors.battleship} Battleship  ${Colors.cruiser} Cruiser  ${Colors.submarine} Submarine  ${Colors.destroyer} Destroyer`,
    ];
  }

  /**
   * Render ship status (health bars)
   */
  static renderShipStatus(board: Board, title?: string): string[] {
    const lines: string[] = [];

    if (title) {
      lines.push(Colors.header(title));
    }

    const ships = board.getShips();
    for (const ship of ships) {
      const remaining = ship.getRemainingHealth();
      const bar = healthBar(remaining, ship.size, ship.size);
      const status = ship.isSunk() ? chalk.red(' SUNK') : '';
      const shipColor = getShipColor(ship.type);

      lines.push(`  ${shipColor(ship.symbol)} ${ship.name.padEnd(10)} ${bar}${status}`);
    }

    return lines;
  }

  /**
   * Render a compact scoreboard
   */
  static renderScoreboard(
    player1: { name: string; shipsRemaining: number },
    player2: { name: string; shipsRemaining: number }
  ): string[] {
    const p1Ships = '█'.repeat(player1.shipsRemaining) + '░'.repeat(5 - player1.shipsRemaining);
    const p2Ships = '█'.repeat(player2.shipsRemaining) + '░'.repeat(5 - player2.shipsRemaining);

    return [
      `  ${Colors.player1(player1.name.padEnd(20))} Ships: ${chalk.green(p1Ships)} ${player1.shipsRemaining}/5`,
      `  ${Colors.player2(player2.name.padEnd(20))} Ships: ${chalk.magenta(p2Ships)} ${player2.shipsRemaining}/5`,
    ];
  }

  /**
   * Strip ANSI codes from a string (for calculating widths)
   */
  private static stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Render a framed display with borders
   */
  static renderFramed(content: string[], width: number, title?: string): string[] {
    const lines: string[] = [];

    // Top border with optional title
    if (title) {
      const titlePadding = Math.max(0, width - title.length - 4);
      const leftPad = Math.floor(titlePadding / 2);
      const rightPad = titlePadding - leftPad;
      lines.push(
        chalk.gray(Box.topLeft) +
        chalk.gray(Box.horizontal.repeat(leftPad)) +
        ' ' + Colors.title(title) + ' ' +
        chalk.gray(Box.horizontal.repeat(rightPad)) +
        chalk.gray(Box.topRight)
      );
    } else {
      lines.push(chalk.gray(Box.topLeft + Box.horizontal.repeat(width) + Box.topRight));
    }

    // Content
    for (const line of content) {
      const strippedLen = this.stripAnsi(line).length;
      const padding = Math.max(0, width - strippedLen);
      lines.push(chalk.gray(Box.vertical) + line + ' '.repeat(padding) + chalk.gray(Box.vertical));
    }

    // Bottom border
    lines.push(chalk.gray(Box.bottomLeft + Box.horizontal.repeat(width) + Box.bottomRight));

    return lines;
  }
}
