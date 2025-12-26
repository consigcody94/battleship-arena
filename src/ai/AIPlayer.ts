/**
 * Base AIPlayer class - abstract interface for AI players
 */

import { Board } from '../game/Board.js';
import { GamePlayer } from '../game/Game.js';
import {
  Coordinate,
  PlayerType,
  ShipPlacement,
  ShotResultDetail,
  coordToString,
} from '../game/types.js';
import { PromptBuilder } from './PromptBuilder.js';

export abstract class AIPlayer implements GamePlayer {
  abstract type: PlayerType;
  abstract name: string;

  protected moveHistory: { coord: Coordinate; result: 'hit' | 'miss' | 'sunk' }[] = [];

  /**
   * Execute a prompt and get the AI's response
   */
  abstract executePrompt(prompt: string): Promise<string>;

  /**
   * Place ships on the board
   */
  async placeShips(board: Board): Promise<ShipPlacement[]> {
    const prompt = PromptBuilder.buildPlacementPrompt();

    try {
      const response = await this.executePrompt(prompt);
      const placements = PromptBuilder.parsePlacementResponse(response);

      if (placements.length === 5) {
        return placements;
      } else {
        console.warn(`${this.name} returned ${placements.length} placements, using random placement`);
        return [];
      }
    } catch (error) {
      console.warn(`${this.name} failed to place ships:`, error);
      return [];
    }
  }

  /**
   * Get the next move
   */
  async getMove(
    ownBoard: Board,
    opponentBoardView: ReturnType<Board['cloneForOpponent']>
  ): Promise<{ coordinate: Coordinate; reasoning?: string }> {
    const prompt = PromptBuilder.buildMovePromptWithReasoning(opponentBoardView, this.moveHistory);

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const response = await this.executePrompt(prompt);
        const parsed = PromptBuilder.parseMoveResponse(response);

        if (parsed.coordinate) {
          // Verify the move is valid (not already fired)
          const firedAt = new Set([
            ...opponentBoardView.hits.map(coordToString),
            ...opponentBoardView.misses.map(coordToString),
            ...(opponentBoardView.sunkCoords || []).map(coordToString),
          ]);

          if (!firedAt.has(coordToString(parsed.coordinate))) {
            return {
              coordinate: parsed.coordinate,
              reasoning: parsed.reasoning,
            };
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          console.warn(`${this.name} made invalid move, retrying...`);
        }
      } catch (error) {
        console.warn(`${this.name} error on attempt ${attempts + 1}:`, error);
        attempts++;
      }
    }

    // Fallback: random valid move
    console.warn(`${this.name} failed to make valid move, using random`);
    return this.getRandomMove(opponentBoardView);
  }

  /**
   * Get a random valid move
   */
  protected getRandomMove(
    opponentBoardView: ReturnType<Board['cloneForOpponent']>
  ): { coordinate: Coordinate; reasoning?: string } {
    const firedAt = new Set([
      ...opponentBoardView.hits.map(coordToString),
      ...opponentBoardView.misses.map(coordToString),
      ...(opponentBoardView.sunkCoords || []).map(coordToString),
    ]);

    const available: Coordinate[] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const coord = { row, col };
        if (!firedAt.has(coordToString(coord))) {
          available.push(coord);
        }
      }
    }

    if (available.length === 0) {
      throw new Error('No valid moves remaining');
    }

    return {
      coordinate: available[Math.floor(Math.random() * available.length)],
      reasoning: 'Random fallback move',
    };
  }

  /**
   * Receive notification of shot result
   */
  notifyResult(result: ShotResultDetail): void {
    this.moveHistory.push({
      coord: result.coordinate,
      result: result.result,
    });
  }

  /**
   * Receive notification of opponent's move
   */
  notifyOpponentMove(coord: Coordinate, result: ShotResultDetail): void {
    // Can be used for additional strategy analysis
  }
}
