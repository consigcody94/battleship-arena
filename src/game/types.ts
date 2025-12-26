/**
 * Core type definitions for the Battleship game engine
 */

// Grid dimensions (standard Battleship is 10x10)
export const GRID_SIZE = 10;
export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

// Ship types and their sizes (official Hasbro rules)
export const SHIP_TYPES = {
  CARRIER: { name: 'Carrier', size: 5, symbol: 'C' },
  BATTLESHIP: { name: 'Battleship', size: 4, symbol: 'B' },
  CRUISER: { name: 'Cruiser', size: 3, symbol: 'R' },
  SUBMARINE: { name: 'Submarine', size: 3, symbol: 'S' },
  DESTROYER: { name: 'Destroyer', size: 2, symbol: 'D' },
} as const;

export type ShipType = keyof typeof SHIP_TYPES;

// Coordinate on the board
export interface Coordinate {
  row: number; // 0-9
  col: number; // 0-9 (A=0, B=1, etc.)
}

// Ship orientation
export type Orientation = 'horizontal' | 'vertical';

// Ship placement information
export interface ShipPlacement {
  type: ShipType;
  start: Coordinate;
  orientation: Orientation;
}

// Cell states for the board
export type CellState =
  | 'empty'      // No ship, not fired upon
  | 'ship'       // Has ship, not hit
  | 'hit'        // Has ship, was hit
  | 'miss'       // No ship, was fired upon
  | 'sunk';      // Ship at this cell is fully sunk

// Result of a shot
export type ShotResult = 'miss' | 'hit' | 'sunk';

// Extended shot result with more details
export interface ShotResultDetail {
  result: ShotResult;
  coordinate: Coordinate;
  shipType?: ShipType;      // If hit or sunk, which ship
  shipSunk?: boolean;        // True if this shot sunk the ship
}

// Cell information including ship reference
export interface Cell {
  state: CellState;
  shipType?: ShipType;
}

// Game phase
export type GamePhase = 'setup' | 'playing' | 'finished';

// Player identifier
export type PlayerType = 'claude' | 'gemini' | 'codex';

// Player state during game
export interface PlayerState {
  type: PlayerType;
  name: string;
  shipsRemaining: number;
  shotsFired: number;
  hits: number;
}

// Game state snapshot
export interface GameState {
  phase: GamePhase;
  currentTurn: PlayerType;
  turnNumber: number;
  players: [PlayerState, PlayerState];
  winner?: PlayerType;
}

// Turn record for game history
export interface TurnRecord {
  turnNumber: number;
  player: PlayerType;
  coordinate: Coordinate;
  result: ShotResult;
  shipSunk?: ShipType;
  reasoning?: string;  // AI's explanation of their move
  timestamp: Date;
}

// Complete game record for saving/replaying
export interface GameRecord {
  id: string;
  startTime: Date;
  endTime?: Date;
  players: [PlayerType, PlayerType];
  winner?: PlayerType;
  turns: TurnRecord[];
  finalState?: GameState;
}

// Helper functions for coordinate conversion
export function coordToString(coord: Coordinate): string {
  return `${COLUMNS[coord.col]}${coord.row + 1}`;
}

export function stringToCoord(str: string): Coordinate | null {
  const match = str.toUpperCase().match(/^([A-J])(\d{1,2})$/);
  if (!match) return null;

  const col = match[1].charCodeAt(0) - 65;
  const row = parseInt(match[2]) - 1;

  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
    return null;
  }

  return { row, col };
}

export function isValidCoordinate(coord: Coordinate): boolean {
  return coord.row >= 0 && coord.row < GRID_SIZE &&
         coord.col >= 0 && coord.col < GRID_SIZE;
}
