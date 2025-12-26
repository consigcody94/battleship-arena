/**
 * Ship class representing a single ship on the board
 */

import {
  ShipType,
  SHIP_TYPES,
  Coordinate,
  Orientation,
  ShipPlacement,
  GRID_SIZE,
  coordToString,
} from './types.js';

export class Ship {
  readonly type: ShipType;
  readonly size: number;
  readonly name: string;
  readonly symbol: string;
  readonly start: Coordinate;
  readonly orientation: Orientation;
  readonly cells: Coordinate[];
  private hitCells: Set<string> = new Set();

  constructor(placement: ShipPlacement) {
    this.type = placement.type;
    this.start = placement.start;
    this.orientation = placement.orientation;

    const shipInfo = SHIP_TYPES[placement.type];
    this.size = shipInfo.size;
    this.name = shipInfo.name;
    this.symbol = shipInfo.symbol;

    // Calculate all cells occupied by this ship
    this.cells = this.calculateCells();
  }

  /**
   * Calculate all coordinates occupied by this ship
   */
  private calculateCells(): Coordinate[] {
    const cells: Coordinate[] = [];
    for (let i = 0; i < this.size; i++) {
      if (this.orientation === 'horizontal') {
        cells.push({ row: this.start.row, col: this.start.col + i });
      } else {
        cells.push({ row: this.start.row + i, col: this.start.col });
      }
    }
    return cells;
  }

  /**
   * Check if this ship occupies a specific coordinate
   */
  occupies(coord: Coordinate): boolean {
    return this.cells.some(c => c.row === coord.row && c.col === coord.col);
  }

  /**
   * Check if this ship overlaps with another ship
   */
  overlaps(other: Ship): boolean {
    return this.cells.some(c1 =>
      other.cells.some(c2 => c1.row === c2.row && c1.col === c2.col)
    );
  }

  /**
   * Check if ship placement is valid (within bounds)
   */
  isWithinBounds(): boolean {
    return this.cells.every(
      c => c.row >= 0 && c.row < GRID_SIZE && c.col >= 0 && c.col < GRID_SIZE
    );
  }

  /**
   * Register a hit on this ship
   * @returns true if this hit sinks the ship
   */
  hit(coord: Coordinate): boolean {
    if (this.occupies(coord)) {
      this.hitCells.add(coordToString(coord));
    }
    return this.isSunk();
  }

  /**
   * Check if this ship has been hit at a specific coordinate
   */
  isHitAt(coord: Coordinate): boolean {
    return this.hitCells.has(coordToString(coord));
  }

  /**
   * Check if all cells of this ship have been hit
   */
  isSunk(): boolean {
    return this.hitCells.size >= this.size;
  }

  /**
   * Get the number of hits on this ship
   */
  getHitCount(): number {
    return this.hitCells.size;
  }

  /**
   * Get remaining health (unhit cells)
   */
  getRemainingHealth(): number {
    return this.size - this.hitCells.size;
  }

  /**
   * Get all coordinates as strings
   */
  getCellStrings(): string[] {
    return this.cells.map(coordToString);
  }

  /**
   * Get hit coordinates as strings
   */
  getHitCellStrings(): string[] {
    return Array.from(this.hitCells);
  }

  /**
   * Create a string representation of the ship for debugging
   */
  toString(): string {
    const status = this.isSunk() ? 'SUNK' : `${this.getRemainingHealth()}/${this.size}`;
    return `${this.name} (${this.symbol}) at ${coordToString(this.start)} ${this.orientation} [${status}]`;
  }

  /**
   * Validate a ship placement before creating
   */
  static validatePlacement(placement: ShipPlacement): string | null {
    const shipInfo = SHIP_TYPES[placement.type];
    if (!shipInfo) {
      return `Invalid ship type: ${placement.type}`;
    }

    const { start, orientation } = placement;

    // Check start position
    if (start.row < 0 || start.row >= GRID_SIZE) {
      return `Invalid starting row: ${start.row + 1}`;
    }
    if (start.col < 0 || start.col >= GRID_SIZE) {
      return `Invalid starting column: ${String.fromCharCode(65 + start.col)}`;
    }

    // Check end position
    if (orientation === 'horizontal') {
      if (start.col + shipInfo.size > GRID_SIZE) {
        return `Ship extends beyond board (ends at column ${String.fromCharCode(65 + start.col + shipInfo.size - 1)})`;
      }
    } else {
      if (start.row + shipInfo.size > GRID_SIZE) {
        return `Ship extends beyond board (ends at row ${start.row + shipInfo.size})`;
      }
    }

    return null; // Valid
  }
}
