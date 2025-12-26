/**
 * PromptBuilder - Creates strategic prompts for AI players
 */

import { Board } from '../game/Board.js';
import {
  Coordinate,
  ShipType,
  ShipPlacement,
  GRID_SIZE,
  COLUMNS,
  SHIP_TYPES,
  coordToString,
} from '../game/types.js';

export class PromptBuilder {
  /**
   * Build a prompt for ship placement
   */
  static buildPlacementPrompt(): string {
    return `You are playing Battleship. Place your fleet on a 10x10 grid (columns A-J, rows 1-10).

You must place these 5 ships:
- Carrier (5 cells)
- Battleship (4 cells)
- Cruiser (3 cells)
- Submarine (3 cells)
- Destroyer (2 cells)

Rules:
- Ships can be horizontal or vertical (no diagonal)
- Ships cannot overlap
- Ships must fit within the grid

Respond with EXACTLY 5 lines in this format:
CARRIER A1 horizontal
BATTLESHIP C3 vertical
CRUISER F5 horizontal
SUBMARINE H2 vertical
DESTROYER J8 horizontal

Use lowercase for orientation. Provide strategic placements - avoid predictable patterns!`;
  }

  /**
   * Build a prompt for making a move
   */
  static buildMovePrompt(
    opponentView: ReturnType<Board['cloneForOpponent']>,
    moveHistory: { coord: Coordinate; result: 'hit' | 'miss' | 'sunk' }[] = []
  ): string {
    const grid = this.renderOpponentGrid(opponentView);
    const analysis = this.analyzeBoard(opponentView, moveHistory);

    return `You are playing Battleship. Here's what you know about your opponent's board:

${grid}

Legend: · = Unknown, ● = Hit, ○ = Miss, X = Sunk ship

${analysis}

Ships remaining to find: ${this.getRemainingShips(opponentView.sunkShips).join(', ') || 'Unknown'}

Based on this information, choose your next shot strategically.
Reply with ONLY the coordinate (e.g., "C5"). No explanation needed.`;
  }

  /**
   * Build a prompt that asks for reasoning along with the move
   */
  static buildMovePromptWithReasoning(
    opponentView: ReturnType<Board['cloneForOpponent']>,
    moveHistory: { coord: Coordinate; result: 'hit' | 'miss' | 'sunk' }[] = []
  ): string {
    const grid = this.renderOpponentGrid(opponentView);
    const analysis = this.analyzeBoard(opponentView, moveHistory);

    return `You are playing Battleship. Analyze the opponent's board and make your next move.

OPPONENT'S BOARD:
${grid}

Legend: · = Unknown, ● = Hit, ○ = Miss, X = Sunk ship

${analysis}

Ships remaining: ${this.getRemainingShips(opponentView.sunkShips).join(', ') || 'All ships still active'}

Think strategically:
1. If there are unhit cells adjacent to hits, target them to sink the ship
2. If hunting, favor center areas and use a checkerboard pattern
3. Consider ship sizes when targeting areas

Respond in this format:
REASONING: [Brief 1-2 sentence explanation of your strategy]
MOVE: [Coordinate like C5]`;
  }

  /**
   * Render the opponent's grid as seen by the player
   */
  private static renderOpponentGrid(
    opponentView: ReturnType<Board['cloneForOpponent']>
  ): string {
    // Create empty grid
    const grid: string[][] = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill('·'));

    // Mark misses first (lowest priority)
    for (const miss of opponentView.misses) {
      grid[miss.row][miss.col] = '○';
    }

    // Mark hits
    for (const hit of opponentView.hits) {
      grid[hit.row][hit.col] = '●';
    }

    // Mark sunk ships (highest priority - overwrites hits)
    const sunkCoords = opponentView.sunkCoords || [];
    for (const sunk of sunkCoords) {
      grid[sunk.row][sunk.col] = 'X';
    }

    // Build the string
    let output = '   ' + COLUMNS.join(' ') + '\n';
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowNum = (row + 1).toString().padStart(2, ' ');
      output += `${rowNum} ${grid[row].join(' ')}\n`;
    }

    return output;
  }

  /**
   * Analyze the board state and provide strategic hints
   */
  private static analyzeBoard(
    opponentView: ReturnType<Board['cloneForOpponent']>,
    moveHistory: { coord: Coordinate; result: 'hit' | 'miss' | 'sunk' }[]
  ): string {
    const hints: string[] = [];

    // Find active hits (hits that aren't part of sunk ships)
    const activeHits = opponentView.hits;

    if (activeHits.length > 0) {
      hints.push(`Active hits: ${activeHits.map(coordToString).join(', ')}`);

      // Check for patterns
      const patterns = this.findHitPatterns(activeHits);
      if (patterns.length > 0) {
        hints.push(`Detected patterns: ${patterns.join('; ')}`);
      }

      // Suggest adjacent cells to target
      const suggestions = this.getAdjacentUnfired(activeHits, opponentView);
      if (suggestions.length > 0) {
        hints.push(`Suggested targets near hits: ${suggestions.slice(0, 4).map(coordToString).join(', ')}`);
      }
    }

    // Calculate board coverage (including sunk cells)
    const sunkCoords = opponentView.sunkCoords || [];
    const totalShots = opponentView.hits.length + opponentView.misses.length + sunkCoords.length;
    const coverage = ((totalShots / (GRID_SIZE * GRID_SIZE)) * 100).toFixed(1);
    hints.push(`Board coverage: ${coverage}% (${totalShots}/100 cells fired upon)`);

    return hints.length > 0 ? hints.join('\n') : 'No hits yet. Try targeting the center area.';
  }

  /**
   * Find patterns in hits (vertical or horizontal lines)
   */
  private static findHitPatterns(hits: Coordinate[]): string[] {
    const patterns: string[] = [];

    // Check for horizontal patterns
    const rowGroups = new Map<number, number[]>();
    for (const hit of hits) {
      if (!rowGroups.has(hit.row)) rowGroups.set(hit.row, []);
      rowGroups.get(hit.row)!.push(hit.col);
    }

    for (const [row, cols] of rowGroups) {
      cols.sort((a, b) => a - b);
      if (cols.length >= 2) {
        // Check for consecutive columns
        let consecutive = 1;
        for (let i = 1; i < cols.length; i++) {
          if (cols[i] === cols[i - 1] + 1) consecutive++;
          else consecutive = 1;
        }
        if (consecutive >= 2) {
          patterns.push(`Horizontal ship detected at row ${row + 1}`);
        }
      }
    }

    // Check for vertical patterns
    const colGroups = new Map<number, number[]>();
    for (const hit of hits) {
      if (!colGroups.has(hit.col)) colGroups.set(hit.col, []);
      colGroups.get(hit.col)!.push(hit.row);
    }

    for (const [col, rows] of colGroups) {
      rows.sort((a, b) => a - b);
      if (rows.length >= 2) {
        let consecutive = 1;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i] === rows[i - 1] + 1) consecutive++;
          else consecutive = 1;
        }
        if (consecutive >= 2) {
          patterns.push(`Vertical ship detected at column ${COLUMNS[col]}`);
        }
      }
    }

    return patterns;
  }

  /**
   * Get adjacent cells that haven't been fired upon
   */
  private static getAdjacentUnfired(
    hits: Coordinate[],
    opponentView: ReturnType<Board['cloneForOpponent']>
  ): Coordinate[] {
    const sunkCoords = opponentView.sunkCoords || [];
    const firedAt = new Set([
      ...opponentView.hits.map(coordToString),
      ...opponentView.misses.map(coordToString),
      ...sunkCoords.map(coordToString),
    ]);

    const adjacent: Coordinate[] = [];
    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];

    for (const hit of hits) {
      for (const dir of directions) {
        const newCoord = { row: hit.row + dir.row, col: hit.col + dir.col };
        if (
          newCoord.row >= 0 &&
          newCoord.row < GRID_SIZE &&
          newCoord.col >= 0 &&
          newCoord.col < GRID_SIZE &&
          !firedAt.has(coordToString(newCoord))
        ) {
          adjacent.push(newCoord);
        }
      }
    }

    // Remove duplicates
    const unique = new Map<string, Coordinate>();
    for (const coord of adjacent) {
      unique.set(coordToString(coord), coord);
    }

    return Array.from(unique.values());
  }

  /**
   * Get ships that haven't been sunk yet
   */
  private static getRemainingShips(sunkShips: ShipType[]): string[] {
    const allShips: ShipType[] = ['CARRIER', 'BATTLESHIP', 'CRUISER', 'SUBMARINE', 'DESTROYER'];
    return allShips
      .filter(ship => !sunkShips.includes(ship))
      .map(ship => `${SHIP_TYPES[ship].name} (${SHIP_TYPES[ship].size})`);
  }

  /**
   * Parse ship placement response from AI
   */
  static parsePlacementResponse(response: string): ShipPlacement[] {
    const placements: ShipPlacement[] = [];
    const lines = response.trim().split('\n');

    const shipMap: Record<string, ShipType> = {
      carrier: 'CARRIER',
      battleship: 'BATTLESHIP',
      cruiser: 'CRUISER',
      submarine: 'SUBMARINE',
      destroyer: 'DESTROYER',
    };

    for (const line of lines) {
      const match = line.toUpperCase().match(/^(CARRIER|BATTLESHIP|CRUISER|SUBMARINE|DESTROYER)\s+([A-J])(\d{1,2})\s+(HORIZONTAL|VERTICAL)/i);
      if (match) {
        const type = shipMap[match[1].toLowerCase()] as ShipType;
        const col = match[2].toUpperCase().charCodeAt(0) - 65;
        const row = parseInt(match[3]) - 1;
        const orientation = match[4].toLowerCase() as 'horizontal' | 'vertical';

        placements.push({
          type,
          start: { row, col },
          orientation,
        });
      }
    }

    return placements;
  }

  /**
   * Parse move response from AI
   */
  static parseMoveResponse(response: string): { coordinate: Coordinate | null; reasoning?: string } {
    // Try to extract reasoning and move
    const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=MOVE:|$)/is);
    const moveMatch = response.match(/MOVE:\s*([A-Ja-j]\d{1,2})/i);

    if (moveMatch) {
      const coordStr = moveMatch[1].toUpperCase();
      const col = coordStr.charCodeAt(0) - 65;
      const row = parseInt(coordStr.slice(1)) - 1;

      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        return {
          coordinate: { row, col },
          reasoning: reasoningMatch ? reasoningMatch[1].trim() : undefined,
        };
      }
    }

    // Fallback: just try to find any coordinate
    const coordMatch = response.match(/([A-Ja-j])(\d{1,2})/);
    if (coordMatch) {
      const col = coordMatch[1].toUpperCase().charCodeAt(0) - 65;
      const row = parseInt(coordMatch[2]) - 1;

      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        return {
          coordinate: { row, col },
          reasoning: reasoningMatch ? reasoningMatch[1].trim() : undefined,
        };
      }
    }

    return { coordinate: null };
  }
}
