/**
 * Game orchestrator - manages the flow of a single Battleship game
 */

import { Board } from './Board.js';
import {
  Coordinate,
  GamePhase,
  GameState,
  PlayerType,
  PlayerState,
  TurnRecord,
  GameRecord,
  ShotResultDetail,
  ShipPlacement,
  SHIP_TYPES,
  coordToString,
} from './types.js';

export interface GamePlayer {
  type: PlayerType;
  name: string;
  placeShips(board: Board): Promise<ShipPlacement[]>;
  getMove(ownBoard: Board, opponentBoardView: ReturnType<Board['cloneForOpponent']>): Promise<{ coordinate: Coordinate; reasoning?: string }>;
  notifyResult(result: ShotResultDetail): void;
  notifyOpponentMove(coord: Coordinate, result: ShotResultDetail): void;
}

export interface GameEvents {
  onTurnStart?: (player: PlayerType, turnNumber: number) => void;
  onTurnEnd?: (record: TurnRecord) => void;
  onShipSunk?: (player: PlayerType, shipType: keyof typeof SHIP_TYPES) => void;
  onGameEnd?: (winner: PlayerType, record: GameRecord) => void;
  onError?: (player: PlayerType, error: Error) => void;
  onPlayerThinking?: (player: PlayerType, message: string) => void;
}

export class Game {
  private boards: Map<PlayerType, Board> = new Map();
  private players: Map<PlayerType, GamePlayer> = new Map();
  private phase: GamePhase = 'setup';
  private currentTurn: PlayerType;
  private turnNumber = 0;
  private turnRecords: TurnRecord[] = [];
  private startTime: Date;
  private events: GameEvents;
  private gameId: string;

  constructor(
    player1: GamePlayer,
    player2: GamePlayer,
    events: GameEvents = {}
  ) {
    this.players.set(player1.type, player1);
    this.players.set(player2.type, player2);
    this.boards.set(player1.type, new Board());
    this.boards.set(player2.type, new Board());
    this.currentTurn = player1.type; // Player 1 goes first
    this.startTime = new Date();
    this.events = events;
    this.gameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current game state
   */
  getState(): GameState {
    const playerTypes = Array.from(this.players.keys());
    const players: [PlayerState, PlayerState] = [
      this.getPlayerState(playerTypes[0]),
      this.getPlayerState(playerTypes[1]),
    ];

    return {
      phase: this.phase,
      currentTurn: this.currentTurn,
      turnNumber: this.turnNumber,
      players,
      winner: this.phase === 'finished' ? this.getWinner() : undefined,
    };
  }

  /**
   * Get a player's current state
   */
  private getPlayerState(playerType: PlayerType): PlayerState {
    const player = this.players.get(playerType)!;
    const board = this.boards.get(playerType)!;
    const stats = board.getStats();

    return {
      type: playerType,
      name: player.name,
      shipsRemaining: stats.shipsRemaining,
      shotsFired: this.turnRecords.filter(t => t.player === playerType).length,
      hits: this.turnRecords.filter(t => t.player === playerType && t.result !== 'miss').length,
    };
  }

  /**
   * Get the winner (if game is finished)
   */
  private getWinner(): PlayerType | undefined {
    for (const [playerType, board] of this.boards) {
      if (board.allShipsSunk()) {
        // Return the OTHER player as winner
        for (const otherType of this.players.keys()) {
          if (otherType !== playerType) return otherType;
        }
      }
    }
    return undefined;
  }

  /**
   * Setup phase - have both players place their ships
   */
  async setup(): Promise<void> {
    if (this.phase !== 'setup') {
      throw new Error('Game is not in setup phase');
    }

    for (const [playerType, player] of this.players) {
      const board = this.boards.get(playerType)!;

      try {
        this.events.onPlayerThinking?.(playerType, 'Placing ships...');
        const placements = await player.placeShips(board);

        // If player returns placements, apply them
        if (placements && placements.length > 0) {
          for (const placement of placements) {
            const result = board.placeShip(placement);
            if (!result.success) {
              throw new Error(`Failed to place ${placement.type}: ${result.error}`);
            }
          }
        }

        // Verify all ships are placed
        if (!board.allShipsPlaced()) {
          // Fallback: place remaining ships randomly
          console.warn(`${player.name} didn't place all ships, placing randomly...`);
          board.placeShipsRandomly();
        }
      } catch (error) {
        this.events.onError?.(playerType, error as Error);
        // Fallback: random placement
        console.warn(`Error during ship placement for ${player.name}, using random placement`);
        const freshBoard = new Board();
        freshBoard.placeShipsRandomly();
        this.boards.set(playerType, freshBoard);
      }
    }

    this.phase = 'playing';
  }

  /**
   * Play one turn
   */
  async playTurn(): Promise<TurnRecord> {
    if (this.phase !== 'playing') {
      throw new Error('Game is not in playing phase');
    }

    this.turnNumber++;
    const currentPlayer = this.players.get(this.currentTurn)!;
    const opponentType = this.getOpponentType(this.currentTurn);
    const ownBoard = this.boards.get(this.currentTurn)!;
    const opponentBoard = this.boards.get(opponentType)!;

    this.events.onTurnStart?.(this.currentTurn, this.turnNumber);
    this.events.onPlayerThinking?.(this.currentTurn, 'Analyzing board and selecting target...');

    let coordinate: Coordinate;
    let reasoning: string | undefined;

    try {
      // Get move from the AI player
      const move = await currentPlayer.getMove(
        ownBoard,
        opponentBoard.cloneForOpponent()
      );
      coordinate = move.coordinate;
      reasoning = move.reasoning;
    } catch (error) {
      this.events.onError?.(this.currentTurn, error as Error);
      // Fallback: random valid move
      const unfired = opponentBoard.getUnfiredCoordinates();
      if (unfired.length === 0) {
        throw new Error('No valid moves remaining');
      }
      coordinate = unfired[Math.floor(Math.random() * unfired.length)];
      reasoning = '(Random fallback due to error)';
    }

    // Execute the shot
    const result = opponentBoard.receiveShot(coordinate);

    // Create turn record
    const record: TurnRecord = {
      turnNumber: this.turnNumber,
      player: this.currentTurn,
      coordinate,
      result: result.result,
      shipSunk: result.shipSunk ? result.shipType : undefined,
      reasoning,
      timestamp: new Date(),
    };

    this.turnRecords.push(record);

    // Notify players
    currentPlayer.notifyResult(result);
    const opponent = this.players.get(opponentType)!;
    opponent.notifyOpponentMove(coordinate, result);

    // Fire events
    this.events.onTurnEnd?.(record);
    if (result.shipSunk && result.shipType) {
      this.events.onShipSunk?.(opponentType, result.shipType);
    }

    // Check for game end
    if (opponentBoard.allShipsSunk()) {
      this.phase = 'finished';
      const gameRecord = this.getGameRecord();
      this.events.onGameEnd?.(this.currentTurn, gameRecord);
    } else {
      // Switch turns
      this.currentTurn = opponentType;
    }

    return record;
  }

  /**
   * Play the entire game until completion
   */
  async play(): Promise<GameRecord> {
    await this.setup();

    while (this.phase === 'playing') {
      await this.playTurn();
    }

    return this.getGameRecord();
  }

  /**
   * Get the opponent's player type
   */
  private getOpponentType(playerType: PlayerType): PlayerType {
    for (const type of this.players.keys()) {
      if (type !== playerType) return type;
    }
    throw new Error('No opponent found');
  }

  /**
   * Get the complete game record
   */
  getGameRecord(): GameRecord {
    return {
      id: this.gameId,
      startTime: this.startTime,
      endTime: this.phase === 'finished' ? new Date() : undefined,
      players: Array.from(this.players.keys()) as [PlayerType, PlayerType],
      winner: this.getWinner(),
      turns: [...this.turnRecords],
      finalState: this.getState(),
    };
  }

  /**
   * Get a specific player's board
   */
  getBoard(playerType: PlayerType): Board | undefined {
    return this.boards.get(playerType);
  }

  /**
   * Get the current turn records
   */
  getTurnRecords(): TurnRecord[] {
    return [...this.turnRecords];
  }

  /**
   * Get current phase
   */
  getPhase(): GamePhase {
    return this.phase;
  }

  /**
   * Get the game ID
   */
  getGameId(): string {
    return this.gameId;
  }
}
