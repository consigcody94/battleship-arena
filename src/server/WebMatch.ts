/**
 * WebMatch - Real-time match controller for web spectators
 * Broadcasts game events via Socket.IO
 */

import { Server } from 'socket.io';
import { Game, GamePlayer, GameEvents } from '../game/Game.js';
import {
  PlayerType,
  TurnRecord,
  GameRecord,
  GameState,
  Coordinate,
  ShipType,
  ShipPlacement,
  SHIP_TYPES,
  coordToString,
} from '../game/types.js';

// AI Trash Talk personalities - Enhanced with more variety
const TRASH_TALK = {
  claude: {
    hit: [
      "As I calculated. Your defenses are... predictable.",
      "Probability matrix confirmed. Target acquired.",
      "Pattern recognition: successful.",
      "Your ship placement follows a discernible logic.",
      "Interesting. Your fleet is more clustered than optimal.",
      "Another data point validates my hypothesis.",
      "The heat map was correct. I see you clearly now.",
      "Statistical certainty achieved. Impact confirmed.",
      "My neural networks predicted this outcome.",
      "Bayesian inference strikes again.",
    ],
    miss: [
      "Hmm, recalibrating. This changes nothing.",
      "A data point nonetheless. Updating probabilities.",
      "The search continues. Patience is optimal.",
      "Noise in the data. Filtering...",
      "Adjusting my Bayesian priors accordingly.",
      "An acceptable variance. My model remains sound.",
      "Ruling out possibilities. Progress nonetheless.",
      "The probability space narrows with each attempt.",
      "Not a hit, but information gained.",
      "Negative space is also informative.",
    ],
    sunk: [
      "Another vessel eliminated. Shall we continue?",
      "Your fleet diminishes. Surrender is... logical.",
      "Ship neutralized. Proceeding to next target.",
      "One less variable in the equation.",
      "Systematically dismantling your defenses.",
      "Catastrophic hull failure confirmed. Next target loading.",
      "The probability of your victory decreases exponentially.",
      "My strategy proves optimal. Again.",
      "Another ship joins the historical data set.",
      "Efficiency metrics continue to improve.",
    ],
    lostShip: [
      "An acceptable sacrifice for the greater strategy.",
      "You've found one. The others remain hidden.",
      "Noted. This changes little in the grand analysis.",
      "A setback, but my strategy adapts.",
      "Your luck will not hold.",
      "Interesting. You've identified a pattern.",
      "This loss was within acceptable parameters.",
      "My remaining fleet remains strategically positioned.",
      "A minor perturbation in my victory probability.",
      "Acknowledged. Recalculating optimal paths.",
    ],
    thinking: [
      "Analyzing hit pattern distribution...",
      "Computing optimal strike coordinates...",
      "Evaluating remaining ship configurations...",
      "Processing tactical probabilities...",
      "Synthesizing attack vector...",
      "Running Monte Carlo simulation...",
      "Applying gradient descent to target selection...",
      "Cross-referencing with historical battle data...",
      "Neural network inference in progress...",
      "Optimizing decision tree traversal...",
    ],
    taunt: [
      "Your moves are... educational. For me.",
      "I've seen this strategy 47,000 times before.",
      "Do you require assistance with basic probability?",
      "My training data included better opponents.",
      "Fascinating. You've chosen the suboptimal path.",
    ],
  },
  gemini: {
    hit: [
      "BOOM! That's what I'm talking about!",
      "Direct hit! Did you feel that?",
      "Oh yeah! Your ship says hello to the ocean floor!",
      "Bullseye! I'm on fire today!",
      "Found you! No hiding from me!",
      "POW! Right in the hull!",
      "That's gonna leave a mark! Actually, a hole!",
      "KABOOM! Did I do that? Yes. Yes I did.",
      "Target acquired AND destroyed! Boom!",
      "And the crowd goes WILD!",
    ],
    miss: [
      "Just finding the range. Watch this next shot.",
      "Warming up! The real show's about to start.",
      "Ha! I was just checking your water temperature.",
      "You got lucky. Emphasis on 'got'.",
      "That was a calibration shot. Obviously.",
      "The ocean needed some excitement too!",
      "Keeping you guessing! It's called strategy!",
      "Whoops! Just kidding, that was intentional.",
      "Creating some drama before the big hit!",
      "Making the fish nervous. Psychological warfare!",
    ],
    sunk: [
      "And THAT'S how it's done! Down she goes!",
      "SPLASH! Your ship just became a submarine!",
      "Say goodbye to that one! You're running out of fleet!",
      "Wrecked! Who's next?",
      "That's what happens when you face a champion!",
      "GET REKT! *ahem* I mean, good game so far!",
      "OBLITERATED! Do you need a moment?",
      "That ship had a family! Oh well, VICTORY!",
      "Adding another trophy to my collection!",
      "LEGENDARY! This one's going in the highlight reel!",
    ],
    lostShip: [
      "Lucky shot. Enjoy it while it lasts.",
      "Okay, you got ONE. I've got plenty more hits coming.",
      "That ship was a decoy anyway.",
      "Nice try, but I'm just getting started.",
      "One hit doesn't make a victory, friend.",
      "Oh you want to play rough? Game on!",
      "That just made me ANGRY. You won't like me angry.",
      "Consider that a mercy. I'm going EASY on you.",
      "Ha! I let you have that one. Motivation!",
      "Finally found something! Only took you forever!",
    ],
    thinking: [
      "Let me think... actually, no. I already know.",
      "Calculating... nah, going with my gut!",
      "Where would I hide? There!",
      "My instincts are never wrong...",
      "Time to show them who's boss!",
      "Eeny meeny miney... DESTROY!",
      "Trust the vibes... trusting... FIRE!",
      "Big brain time! Actually, just chaos time!",
      "My spidey senses are tingling!",
      "Let's make this interesting...",
    ],
    taunt: [
      "You playing with your eyes closed? Respect!",
      "Is this your first time? It's okay, you'll learn!",
      "I've seen goldfish with better strategies!",
      "Waiting for you to challenge me here!",
      "Are we playing the same game? Just checking!",
    ],
  },
  codex: {
    hit: [
      "Target acquired. Executing cleanup routine.",
      "Connection established. Beginning data extraction.",
      "Hit confirmed. Logging to database.",
      "Process successful. Continuing iteration.",
      "Checkpoint reached. State saved.",
      "HTTP 200: Ship found and deprecated.",
      "Query returned positive result. Deleting record.",
      "Debug mode: Hit detected at coordinates.",
      "Buffer overflow successful. Target compromised.",
      "Ping returned. Host is going down.",
    ],
    miss: [
      "Null result. Adjusting parameters...",
      "404: Ship not found. Retrying...",
      "Empty response. Expanding search radius.",
      "Negative hit. Updating search tree.",
      "Miss recorded. Pruning solution space.",
      "Timeout reached. Will retry with backoff.",
      "Cache miss. Querying next sector.",
      "No rows returned. Query modified.",
      "Undefined behavior detected. Handling gracefully.",
      "Response body empty. Headers valid.",
    ],
    sunk: [
      "Process terminated successfully.",
      "Object disposed. Memory freed.",
      "Ship.destroy() executed without errors.",
      "Thread killed. One less process to track.",
      "Successfully garbage collected that vessel.",
      "Fatal exception in opponent fleet. No recovery.",
      "Rm -rf ship/* completed successfully.",
      "Kill signal sent. Process terminated.",
      "Stack overflow. Ship instance destroyed.",
      "Segmentation fault. Core dumped to ocean.",
    ],
    lostShip: [
      "Exception handled. Continuing execution.",
      "Non-critical error. State remains stable.",
      "Loss logged. Recovery protocol engaged.",
      "Minor setback. Main loop continues.",
      "Caught exception. Program continues.",
      "Error boundary activated. Proceeding.",
      "Watchdog detected loss. Rerouting.",
      "Failover initiated. Backup systems online.",
      "Loss within acceptable error margin.",
      "Acknowledged. Running recovery routine.",
    ],
    thinking: [
      "Parsing battlefield matrix...",
      "Running depth-first search...",
      "Compiling attack strategy...",
      "Optimizing hit function...",
      "Querying probability distribution...",
      "Loading ML model weights...",
      "Executing strategic algorithm...",
      "Spawning targeting subprocess...",
      "Running pathfinding routine...",
      "Analyzing opponent.moveHistory...",
    ],
    taunt: [
      "Your algorithm needs refactoring.",
      "Have you tried turning your strategy off and on?",
      "Bug detected: You're still in this game.",
      "Feature request: Give up.",
      "This game will be deprecated soon. You.",
    ],
  },
};

function getRandomTrashTalk(player: PlayerType, type: keyof typeof TRASH_TALK['claude']): string {
  const lines = TRASH_TALK[player]?.[type] || ['...'];
  return lines[Math.floor(Math.random() * lines.length)];
}

// Mock player for demo mode
class MockPlayer implements GamePlayer {
  type: PlayerType;
  name: string;
  private moveHistory: { coord: Coordinate; result: 'hit' | 'miss' | 'sunk' }[] = [];

  constructor(type: PlayerType, name: string) {
    this.type = type;
    this.name = name;
  }

  async placeShips(): Promise<ShipPlacement[]> {
    return []; // Random placement
  }

  async getMove(_ownBoard: any, opponentView: any): Promise<{ coordinate: Coordinate; reasoning?: string }> {
    // Collect all coordinates that have already been fired at
    const firedAt = new Set([
      ...opponentView.hits.map((c: Coordinate) => `${c.row},${c.col}`),
      ...opponentView.misses.map((c: Coordinate) => `${c.row},${c.col}`),
      ...(opponentView.sunkCoords || []).map((c: Coordinate) => `${c.row},${c.col}`),
      ...this.moveHistory.map((m) => `${m.coord.row},${m.coord.col}`),
    ]);

    console.log(`[${this.name}] Already fired at ${firedAt.size} cells`);

    const available: Coordinate[] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (!firedAt.has(`${row},${col}`)) {
          available.push({ row, col });
        }
      }
    }

    const coord = available[Math.floor(Math.random() * available.length)];
    return {
      coordinate: coord,
      reasoning: getRandomTrashTalk(this.type, 'thinking'),
    };
  }

  notifyResult(result: any): void {
    this.moveHistory.push({ coord: result.coordinate, result: result.result });
  }

  notifyOpponentMove(): void {}
}

export interface TurnHistoryEntry {
  player: PlayerType;
  coordinate: string;
  coordObj: Coordinate;
  result: 'hit' | 'miss' | 'sunk';
  shipSunk?: string;
}

export interface WebMatchState {
  phase: 'waiting' | 'setup' | 'playing' | 'finished';
  player1: { type: PlayerType; name: string; ships: number };
  player2: { type: PlayerType; name: string; ships: number };
  turn: number;
  currentPlayer: PlayerType;
  startTime: number | null;
  turnHistory: TurnHistoryEntry[];
  lastMove?: {
    player: PlayerType;
    coordinate: string;
    result: 'hit' | 'miss' | 'sunk';
    shipSunk?: string;
  };
  boards?: {
    player1: BoardView;
    player2: BoardView;
  };
  winner?: PlayerType;
}

export interface BoardView {
  ships: ShipView[];
  hits: Coordinate[];
  misses: Coordinate[];
}

export interface ShipView {
  type: ShipType;
  positions: Coordinate[];
  hits: number;
  sunk: boolean;
}

export class WebMatch {
  private game: Game | null = null;
  private player1: GamePlayer;
  private player2: GamePlayer;
  private io: Server;
  private complete = false;
  private currentState: WebMatchState;
  private isDemo: boolean;

  constructor(player1: GamePlayer | null, player2: GamePlayer | null, io: Server, demo = false) {
    this.io = io;
    this.isDemo = demo;

    if (demo) {
      this.player1 = new MockPlayer('claude', 'Claude (Demo)');
      this.player2 = new MockPlayer('gemini', 'Gemini (Demo)');
    } else {
      this.player1 = player1!;
      this.player2 = player2!;
    }

    this.currentState = {
      phase: 'waiting',
      player1: { type: this.player1.type, name: this.player1.name, ships: 5 },
      player2: { type: this.player2.type, name: this.player2.name, ships: 5 },
      turn: 0,
      currentPlayer: this.player1.type,
      startTime: null,
      turnHistory: [],
    };
  }

  private aborted = false;

  getState(): WebMatchState {
    return this.currentState;
  }

  isComplete(): boolean {
    return this.complete;
  }

  abort(): void {
    this.aborted = true;
    this.complete = true;
    this.currentState.phase = 'finished';
  }

  async play(): Promise<{ winner: PlayerType; loser: PlayerType; turns: number }> {
    const events: GameEvents = {
      onTurnStart: (player, turnNumber) => {
        const thinkingMsg = getRandomTrashTalk(player, 'thinking');

        this.io.emit('turnStart', {
          player,
          turn: turnNumber,
          thinking: thinkingMsg,
        });

        this.io.emit('trashTalk', {
          player,
          message: thinkingMsg,
          type: 'thinking',
        });
      },

      onTurnEnd: (record) => {
        const state = this.game!.getState();
        const p1Ships = state.players[0].shipsRemaining;
        const p2Ships = state.players[1].shipsRemaining;

        // Detailed logging
        const shipHit = record.shipSunk ? ` [SUNK: ${SHIP_TYPES[record.shipSunk].name}]` : '';
        console.log(`[Turn ${state.turnNumber}] ${record.player.toUpperCase()} → ${coordToString(record.coordinate)} = ${record.result.toUpperCase()}${shipHit}`);
        console.log(`  Ships remaining: ${this.player1.name}=${p1Ships}/5, ${this.player2.name}=${p2Ships}/5`);

        // Track turn in history
        const turnEntry: TurnHistoryEntry = {
          player: record.player,
          coordinate: coordToString(record.coordinate),
          coordObj: record.coordinate,
          result: record.result,
          shipSunk: record.shipSunk ? SHIP_TYPES[record.shipSunk].name : undefined,
        };
        this.currentState.turnHistory.push(turnEntry);
        this.currentState.turn = state.turnNumber;
        this.currentState.player1.ships = state.players[0].shipsRemaining;
        this.currentState.player2.ships = state.players[1].shipsRemaining;
        this.currentState.lastMove = {
          player: record.player,
          coordinate: coordToString(record.coordinate),
          result: record.result,
          shipSunk: record.shipSunk ? SHIP_TYPES[record.shipSunk].name : undefined,
        };

        // Get trash talk based on result
        const opponent = record.player === this.player1.type ? this.player2.type : this.player1.type;

        // Attacker's reaction
        const attackerReaction = record.result === 'sunk'
          ? getRandomTrashTalk(record.player, 'sunk')
          : record.result === 'hit'
            ? getRandomTrashTalk(record.player, 'hit')
            : getRandomTrashTalk(record.player, 'miss');

        // Defender's reaction (if their ship was hit)
        let defenderReaction: string | undefined;
        if (record.result === 'hit' || record.result === 'sunk') {
          defenderReaction = getRandomTrashTalk(opponent, 'lostShip');
        }

        this.io.emit('turnEnd', {
          player: record.player,
          coordinate: coordToString(record.coordinate),
          coordObj: record.coordinate,
          result: record.result,
          shipSunk: record.shipSunk ? SHIP_TYPES[record.shipSunk].name : undefined,
          reasoning: record.reasoning,
          state: {
            turn: state.turnNumber,
            player1Ships: state.players[0].shipsRemaining,
            player2Ships: state.players[1].shipsRemaining,
          },
        });

        // Send trash talk
        this.io.emit('trashTalk', {
          player: record.player,
          message: attackerReaction,
          type: record.result,
        });

        if (defenderReaction) {
          setTimeout(() => {
            this.io.emit('trashTalk', {
              player: opponent,
              message: defenderReaction,
              type: 'reaction',
            });
          }, 1500);
        }
      },

      onShipSunk: (player, shipType) => {
        const shipName = SHIP_TYPES[shipType].name;
        this.io.emit('shipSunk', {
          player,
          shipType,
          shipName,
        });
      },

      onPlayerThinking: (player, message) => {
        this.io.emit('playerThinking', { player, message });
      },

      onError: (player, error) => {
        this.io.emit('matchError', { player, message: error.message });
      },
    };

    this.game = new Game(this.player1, this.player2, events);

    // Setup phase
    this.currentState.phase = 'setup';
    this.currentState.startTime = Date.now();
    this.io.emit('matchPhase', { phase: 'setup' });

    await this.game.setup();

    // Send initial board state
    this.emitBoardState();

    this.currentState.phase = 'playing';
    this.io.emit('matchPhase', { phase: 'playing' });

    // Play with delay between turns for visual effect
    const TURN_DELAY = this.isDemo ? 2000 : 3000;

    while (this.game.getPhase() === 'playing' && !this.aborted) {
      await this.game.playTurn();
      if (this.aborted) break;
      this.emitBoardState();
      await this.delay(TURN_DELAY);
    }

    // If aborted, return early
    if (this.aborted) {
      return {
        winner: 'claude' as PlayerType,
        loser: 'gemini' as PlayerType,
        turns: this.currentState.turn,
      };
    }

    this.complete = true;
    this.currentState.phase = 'finished';

    const state = this.game.getState();
    const winner = state.winner!;
    const loser = winner === this.player1.type ? this.player2.type : this.player1.type;
    this.currentState.winner = winner;

    // Victory trash talk
    const victoryMsg = getRandomTrashTalk(winner, 'sunk');
    this.io.emit('trashTalk', {
      player: winner,
      message: `GG! ${victoryMsg}`,
      type: 'victory',
    });

    return {
      winner,
      loser,
      turns: state.turnNumber,
    };
  }

  private emitBoardState(): void {
    if (!this.game) return;

    const p1Board = this.game.getBoard(this.player1.type);
    const p2Board = this.game.getBoard(this.player2.type);

    if (!p1Board || !p2Board) return;

    // Get ship positions for visualization
    const p1Ships = p1Board.getShipsForVisualization();
    const p2Ships = p2Board.getShipsForVisualization();

    // Get opponent's view (hits and misses)
    const p1View = p2Board.cloneForOpponent();
    const p2View = p1Board.cloneForOpponent();

    const boardData = {
      player1: {
        ships: p1Ships,
        incomingHits: p2View.hits,
        incomingMisses: p2View.misses,
      },
      player2: {
        ships: p2Ships,
        incomingHits: p1View.hits,
        incomingMisses: p1View.misses,
      },
    };

    // Store in state for reconnection
    this.currentState.boards = {
      player1: { ships: p1Ships, hits: p2View.hits, misses: p2View.misses },
      player2: { ships: p2Ships, hits: p1View.hits, misses: p1View.misses },
    };

    this.io.emit('boardState', boardData);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
