/**
 * Board class representing a player's game board
 */

import { Ship } from './Ship.js';
import {
  Coordinate,
  Cell,
  CellState,
  ShipType,
  ShipPlacement,
  ShotResult,
  ShotResultDetail,
  GRID_SIZE,
  SHIP_TYPES,
  COLUMNS,
  coordToString,
  isValidCoordinate,
} from './types.js';

export class Board {
  private grid: Cell[][];
  private ships: Ship[] = [];
  private shotsFired: Set<string> = new Set();

  constructor() {
    // Initialize empty grid
    this.grid = Array(GRID_SIZE)
      .fill(null)
      .map(() =>
        Array(GRID_SIZE)
          .fill(null)
          .map(() => ({ state: 'empty' as CellState }))
      );
  }

  /**
   * Place a ship on the board
   */
  placeShip(placement: ShipPlacement): { success: boolean; error?: string } {
    // Validate placement
    const validationError = Ship.validatePlacement(placement);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Create the ship
    const ship = new Ship(placement);

    // Check for overlaps with existing ships
    for (const existingShip of this.ships) {
      if (ship.overlaps(existingShip)) {
        return { success: false, error: `Ship overlaps with ${existingShip.name}` };
      }
    }

    // Check if ship type already placed
    if (this.ships.some(s => s.type === ship.type)) {
      return { success: false, error: `${ship.name} already placed` };
    }

    // Place the ship
    this.ships.push(ship);
    for (const cell of ship.cells) {
      this.grid[cell.row][cell.col] = {
        state: 'ship',
        shipType: ship.type,
      };
    }

    return { success: true };
  }

  /**
   * Place all ships randomly
   */
  placeShipsRandomly(): void {
    const shipTypes: ShipType[] = ['CARRIER', 'BATTLESHIP', 'CRUISER', 'SUBMARINE', 'DESTROYER'];

    for (const type of shipTypes) {
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100;

      while (!placed && attempts < maxAttempts) {
        const orientation: 'horizontal' | 'vertical' = Math.random() < 0.5 ? 'horizontal' : 'vertical';
        const shipInfo = SHIP_TYPES[type];

        let maxRow = GRID_SIZE;
        let maxCol = GRID_SIZE;

        if (orientation === 'horizontal') {
          maxCol = GRID_SIZE - shipInfo.size + 1;
        } else {
          maxRow = GRID_SIZE - shipInfo.size + 1;
        }

        const start: Coordinate = {
          row: Math.floor(Math.random() * maxRow),
          col: Math.floor(Math.random() * maxCol),
        };

        const result = this.placeShip({ type, start, orientation });
        placed = result.success;
        attempts++;
      }

      if (!placed) {
        throw new Error(`Failed to place ${type} after ${maxAttempts} attempts`);
      }
    }
  }

  /**
   * Receive a shot at the given coordinate
   */
  receiveShot(coord: Coordinate): ShotResultDetail {
    if (!isValidCoordinate(coord)) {
      throw new Error(`Invalid coordinate: ${coordToString(coord)}`);
    }

    const coordStr = coordToString(coord);
    if (this.shotsFired.has(coordStr)) {
      throw new Error(`Already fired at ${coordStr}`);
    }

    this.shotsFired.add(coordStr);
    const cell = this.grid[coord.row][coord.col];

    if (cell.state === 'ship') {
      // Find the ship and register the hit
      const ship = this.ships.find(s => s.type === cell.shipType);
      if (!ship) {
        throw new Error(`Ship not found for cell at ${coordStr}`);
      }

      const sunk = ship.hit(coord);
      cell.state = sunk ? 'sunk' : 'hit';

      // If ship sunk, mark all its cells as sunk
      if (sunk) {
        for (const shipCell of ship.cells) {
          this.grid[shipCell.row][shipCell.col].state = 'sunk';
        }
      }

      return {
        result: sunk ? 'sunk' : 'hit',
        coordinate: coord,
        shipType: ship.type,
        shipSunk: sunk,
      };
    } else {
      cell.state = 'miss';
      return {
        result: 'miss',
        coordinate: coord,
      };
    }
  }

  /**
   * Check if all ships are sunk
   */
  allShipsSunk(): boolean {
    return this.ships.every(ship => ship.isSunk());
  }

  /**
   * Get count of remaining ships
   */
  getShipsRemaining(): number {
    return this.ships.filter(ship => !ship.isSunk()).length;
  }

  /**
   * Get all ships on this board
   */
  getShips(): Ship[] {
    return [...this.ships];
  }

  /**
   * Get cell state at coordinate
   */
  getCell(coord: Coordinate): Cell {
    if (!isValidCoordinate(coord)) {
      throw new Error(`Invalid coordinate: ${coordToString(coord)}`);
    }
    return this.grid[coord.row][coord.col];
  }

  /**
   * Check if a coordinate has been fired upon
   */
  hasBeenFiredUpon(coord: Coordinate): boolean {
    return this.shotsFired.has(coordToString(coord));
  }

  /**
   * Get all unfired coordinates (for AI decision making)
   */
  getUnfiredCoordinates(): Coordinate[] {
    const unfired: Coordinate[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!this.shotsFired.has(coordToString({ row, col }))) {
          unfired.push({ row, col });
        }
      }
    }
    return unfired;
  }

  /**
   * Get coordinates of hits that are not yet sunk (useful for AI targeting)
   */
  getActiveHits(): Coordinate[] {
    const activeHits: Coordinate[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (this.grid[row][col].state === 'hit') {
          activeHits.push({ row, col });
        }
      }
    }
    return activeHits;
  }

  /**
   * Check if all required ships are placed
   */
  allShipsPlaced(): boolean {
    const requiredTypes: ShipType[] = ['CARRIER', 'BATTLESHIP', 'CRUISER', 'SUBMARINE', 'DESTROYER'];
    return requiredTypes.every(type => this.ships.some(s => s.type === type));
  }

  /**
   * Render the board as ASCII for own view (shows ships)
   */
  renderOwn(): string {
    let output = '   ' + COLUMNS.join(' ') + '\n';

    for (let row = 0; row < GRID_SIZE; row++) {
      const rowNum = (row + 1).toString().padStart(2, ' ');
      const cells = [];

      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.grid[row][col];
        switch (cell.state) {
          case 'empty':
            cells.push('~');
            break;
          case 'ship':
            cells.push(cell.shipType ? SHIP_TYPES[cell.shipType].symbol : 'S');
            break;
          case 'hit':
            cells.push('*');
            break;
          case 'miss':
            cells.push('o');
            break;
          case 'sunk':
            cells.push('X');
            break;
        }
      }

      output += `${rowNum} ${cells.join(' ')}\n`;
    }

    return output;
  }

  /**
   * Render the board as ASCII for opponent view (hides ships)
   */
  renderOpponent(): string {
    let output = '   ' + COLUMNS.join(' ') + '\n';

    for (let row = 0; row < GRID_SIZE; row++) {
      const rowNum = (row + 1).toString().padStart(2, ' ');
      const cells = [];

      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.grid[row][col];
        switch (cell.state) {
          case 'empty':
          case 'ship':  // Hide ships from opponent
            cells.push('.');
            break;
          case 'hit':
            cells.push('*');
            break;
          case 'miss':
            cells.push('o');
            break;
          case 'sunk':
            cells.push('X');
            break;
        }
      }

      output += `${rowNum} ${cells.join(' ')}\n`;
    }

    return output;
  }

  /**
   * Get statistics for this board
   */
  getStats(): {
    shipsPlaced: number;
    shipsRemaining: number;
    shipsSunk: number;
    totalCells: number;
    hits: number;
    misses: number;
  } {
    let hits = 0;
    let misses = 0;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const state = this.grid[row][col].state;
        if (state === 'hit' || state === 'sunk') hits++;
        if (state === 'miss') misses++;
      }
    }

    return {
      shipsPlaced: this.ships.length,
      shipsRemaining: this.getShipsRemaining(),
      shipsSunk: this.ships.filter(s => s.isSunk()).length,
      totalCells: GRID_SIZE * GRID_SIZE,
      hits,
      misses,
    };
  }

  /**
   * Get ships for 3D visualization
   */
  getShipsForVisualization(): Array<{
    type: ShipType;
    positions: Coordinate[];
    hits: number;
    sunk: boolean;
  }> {
    return this.ships.map(ship => ({
      type: ship.type,
      positions: [...ship.cells],
      hits: ship.getHitCount(),
      sunk: ship.isSunk(),
    }));
  }

  /**
   * Create a copy of the board for AI viewing (opponent's perspective)
   */
  cloneForOpponent(): { hits: Coordinate[]; misses: Coordinate[]; sunkShips: ShipType[]; sunkCoords: Coordinate[] } {
    const hits: Coordinate[] = [];
    const misses: Coordinate[] = [];
    const sunkShips: ShipType[] = [];
    const sunkCoords: Coordinate[] = [];

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = this.grid[row][col];
        if (cell.state === 'hit') {
          hits.push({ row, col });
        } else if (cell.state === 'miss') {
          misses.push({ row, col });
        } else if (cell.state === 'sunk') {
          // Track sunk coordinates (these have been fired at!)
          sunkCoords.push({ row, col });
          if (cell.shipType && !sunkShips.includes(cell.shipType)) {
            sunkShips.push(cell.shipType);
          }
        }
      }
    }

    return { hits, misses, sunkShips, sunkCoords };
  }
}
