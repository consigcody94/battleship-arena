/**
 * Match - Single match controller with visualization
 */

import { Game, GamePlayer, GameEvents } from '../game/Game.js';
import {
  PlayerType,
  TurnRecord,
  GameRecord,
  SHIP_TYPES,
} from '../game/types.js';
import { MatchDisplay } from '../ui/MatchDisplay.js';

export interface MatchOptions {
  displayWidth?: number;
  showEmoji?: boolean;
  delayBetweenTurns?: number;  // ms delay between turns for visualization
  verbose?: boolean;
}

export interface MatchResult {
  winner: PlayerType;
  loser: PlayerType;
  turns: number;
  duration: number;  // ms
  record: GameRecord;
}

export class Match {
  private display: MatchDisplay;
  private options: MatchOptions;

  constructor(options: MatchOptions = {}) {
    this.options = {
      displayWidth: 80,
      showEmoji: true,
      delayBetweenTurns: 500,
      verbose: true,
      ...options,
    };

    this.display = new MatchDisplay({
      width: this.options.displayWidth,
      showEmoji: this.options.showEmoji,
    });
  }

  /**
   * Play a match between two AI players
   */
  async play(player1: GamePlayer, player2: GamePlayer): Promise<MatchResult> {
    const startTime = Date.now();
    let lastTurn: TurnRecord | undefined;
    let thinkingMessage: { player: PlayerType; message: string } | undefined;

    // Create game with event handlers
    const events: GameEvents = {
      onTurnStart: (player, turnNumber) => {
        if (this.options.verbose) {
          this.updateDisplay(game, [player1, player2], lastTurn, {
            player,
            message: 'Analyzing board and selecting target...',
          });
        }
      },

      onTurnEnd: (record) => {
        lastTurn = record;
        if (this.options.verbose) {
          this.updateDisplay(game, [player1, player2], lastTurn);
        }
      },

      onShipSunk: (player, shipType) => {
        if (this.options.verbose) {
          const shipName = SHIP_TYPES[shipType].name;
          this.display.message(`  ${shipName} has been sunk!`, 'warning');
        }
      },

      onPlayerThinking: (player, message) => {
        thinkingMessage = { player, message };
      },

      onError: (player, error) => {
        this.display.message(`  Error from ${player}: ${error.message}`, 'error');
      },
    };

    const game = new Game(player1, player2, events);

    // Clear screen and show initial state
    if (this.options.verbose) {
      this.display.clear();
      this.display.message('Setting up game...', 'info');
    }

    // Setup phase
    await game.setup();

    if (this.options.verbose) {
      this.updateDisplay(game, [player1, player2]);
      await this.delay(1000);
    }

    // Play until finished
    while (game.getPhase() === 'playing') {
      await game.playTurn();

      if (this.options.delayBetweenTurns && this.options.delayBetweenTurns > 0) {
        await this.delay(this.options.delayBetweenTurns);
      }
    }

    const endTime = Date.now();
    const record = game.getGameRecord();
    const state = game.getState();

    // Show final state
    if (this.options.verbose && state.winner) {
      this.display.renderGameOver(
        state.winner,
        state.winner === player1.type ? player2.type : player1.type,
        state.turnNumber,
        endTime - startTime
      );
    }

    return {
      winner: state.winner!,
      loser: state.winner === player1.type ? player2.type : player1.type,
      turns: state.turnNumber,
      duration: endTime - startTime,
      record,
    };
  }

  /**
   * Update the display
   */
  private updateDisplay(
    game: Game,
    players: [GamePlayer, GamePlayer],
    lastTurn?: TurnRecord,
    thinking?: { player: PlayerType; message: string }
  ): void {
    this.display.clear();
    this.display.render(game, players, lastTurn, thinking);
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
