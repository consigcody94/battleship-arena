/**
 * Color definitions for the Battleship Arena UI
 */

import chalk from 'chalk';

// Board cell colors
export const Colors = {
  // Water and empty cells
  water: chalk.blue('░'),
  waterDim: chalk.dim.blue('~'),
  unknown: chalk.gray('·'),

  // Ship colors (when showing own board)
  carrier: chalk.magenta.bold('C'),
  battleship: chalk.cyan.bold('B'),
  cruiser: chalk.green.bold('R'),
  submarine: chalk.yellow.bold('S'),
  destroyer: chalk.white.bold('D'),

  // Hit and miss markers
  hit: chalk.red.bold('●'),
  miss: chalk.white('○'),
  sunk: chalk.red.bold('X'),

  // UI elements
  border: chalk.gray,
  borderBold: chalk.white,
  header: chalk.cyan.bold,
  title: chalk.yellow.bold,
  subtitle: chalk.gray,

  // Player colors
  player1: chalk.cyan.bold,
  player2: chalk.magenta.bold,

  // Status indicators
  success: chalk.green.bold,
  error: chalk.red.bold,
  warning: chalk.yellow.bold,
  info: chalk.blue,
  thinking: chalk.gray.italic,

  // Turn indicator
  currentTurn: chalk.bgCyan.black.bold,
  waitingTurn: chalk.gray.dim,

  // Ship health bars
  healthFull: chalk.green('█'),
  healthDamaged: chalk.yellow('█'),
  healthSunk: chalk.red('░'),
  healthEmpty: chalk.gray('░'),
};

// Ship type to color mapping
export function getShipColor(shipType: string): (text: string) => string {
  const colorMap: Record<string, (text: string) => string> = {
    CARRIER: (t) => chalk.magenta.bold(t),
    BATTLESHIP: (t) => chalk.cyan.bold(t),
    CRUISER: (t) => chalk.green.bold(t),
    SUBMARINE: (t) => chalk.yellow.bold(t),
    DESTROYER: (t) => chalk.white.bold(t),
  };
  return colorMap[shipType] || ((t) => t);
}

// Box drawing characters for borders
export const Box = {
  topLeft: '╔',
  topRight: '╗',
  bottomLeft: '╚',
  bottomRight: '╝',
  horizontal: '═',
  vertical: '║',
  teeRight: '╠',
  teeLeft: '╣',
  teeDown: '╦',
  teeUp: '╩',
  cross: '╬',

  // Light versions
  lightHorizontal: '─',
  lightVertical: '│',
  lightTopLeft: '┌',
  lightTopRight: '┐',
  lightBottomLeft: '└',
  lightBottomRight: '┘',
};

// Create a horizontal line of given width
export function horizontalLine(width: number, char: string = Box.horizontal): string {
  return char.repeat(width);
}

// Create a boxed title
export function boxedTitle(title: string, width: number): string[] {
  const padding = Math.max(0, width - title.length - 2);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  return [
    Colors.border(Box.topLeft + horizontalLine(width) + Box.topRight),
    Colors.border(Box.vertical) + ' '.repeat(leftPad) + Colors.title(title) + ' '.repeat(rightPad) + Colors.border(Box.vertical),
    Colors.border(Box.bottomLeft + horizontalLine(width) + Box.bottomRight),
  ];
}

// Format a health bar
export function healthBar(current: number, max: number, width: number = 10): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;

  let color = Colors.healthFull;
  if (current <= max * 0.3) color = Colors.healthDamaged;
  if (current === 0) return Colors.healthSunk.repeat(width);

  return chalk.green('█').repeat(filled) + Colors.healthEmpty.repeat(empty);
}

// Emoji for flavor (can be disabled)
export const Emoji = {
  anchor: '⚓',
  ship: '🚢',
  fire: '🔥',
  water: '💧',
  explosion: '💥',
  skull: '💀',
  trophy: '🏆',
  thinking: '🤔',
  target: '🎯',
  wave: '🌊',
};
