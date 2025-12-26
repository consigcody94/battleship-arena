/**
 * AI Battleship Arena - Web Server
 * Serves the 3D spectator experience via Express + Socket.IO
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { WebMatch } from './WebMatch.js';
import { ClaudePlayer } from '../ai/ClaudePlayer.js';
import { GeminiPlayer } from '../ai/GeminiPlayer.js';
import { CodexPlayer } from '../ai/CodexPlayer.js';
import { GamePlayer } from '../game/Game.js';
import { PlayerType } from '../game/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
const publicPath = join(__dirname, '../../public');
app.use(express.static(publicPath));

// Current match state
let currentMatch: WebMatch | null = null;
let spectatorCount = 0;

/**
 * Create a player instance
 */
function createPlayer(type: PlayerType): GamePlayer {
  switch (type) {
    case 'claude':
      return new ClaudePlayer();
    case 'gemini':
      return new GeminiPlayer();
    case 'codex':
      return new CodexPlayer();
    default:
      throw new Error(`Unknown player type: ${type}`);
  }
}

/**
 * Check available AI CLIs
 */
async function checkAvailablePlayers(): Promise<Record<PlayerType, boolean>> {
  const [claude, gemini, codex] = await Promise.all([
    ClaudePlayer.isAvailable(),
    GeminiPlayer.isAvailable(),
    CodexPlayer.isAvailable(),
  ]);
  return { claude, gemini, codex };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  spectatorCount++;
  console.log(`Spectator connected (${spectatorCount} watching)`);

  // Send current game state if match is in progress
  if (currentMatch) {
    socket.emit('matchState', currentMatch.getState());
  }

  socket.emit('spectatorCount', spectatorCount);
  socket.broadcast.emit('spectatorCount', spectatorCount);

  // Start a new match
  socket.on('startMatch', async (data: { player1: PlayerType; player2: PlayerType }) => {
    if (currentMatch && !currentMatch.isComplete()) {
      socket.emit('error', 'A match is already in progress');
      return;
    }

    console.log(`Starting match: ${data.player1} vs ${data.player2}`);

    try {
      const player1 = createPlayer(data.player1);
      const player2 = createPlayer(data.player2);

      currentMatch = new WebMatch(player1, player2, io);

      io.emit('matchStarting', {
        player1: { type: data.player1, name: player1.name },
        player2: { type: data.player2, name: player2.name }
      });

      // Run the match (this will emit events as it progresses)
      const result = await currentMatch.play();

      io.emit('matchComplete', result);

    } catch (error) {
      console.error('Match error:', error);
      io.emit('matchError', { message: (error as Error).message });
    }
  });

  // Start demo match with mock players
  socket.on('startDemo', async () => {
    if (currentMatch && !currentMatch.isComplete()) {
      socket.emit('error', 'A match is already in progress');
      return;
    }

    console.log('Starting demo match');

    currentMatch = new WebMatch(null, null, io, true);

    io.emit('matchStarting', {
      player1: { type: 'claude', name: 'Claude (Demo)' },
      player2: { type: 'gemini', name: 'Gemini (Demo)' }
    });

    const result = await currentMatch.play();
    io.emit('matchComplete', result);
  });

  // Check available players
  socket.on('checkPlayers', async () => {
    const available = await checkAvailablePlayers();
    socket.emit('playersAvailable', available);
  });

  // End current match
  socket.on('endMatch', () => {
    if (currentMatch) {
      console.log('Match ended by user');
      currentMatch.abort();
      currentMatch = null;
      io.emit('matchEnded', { reason: 'User ended the match' });
      io.emit('matchPhase', { phase: 'waiting' });
    }
  });

  // Reset server (clear all state without killing process)
  socket.on('restartServer', () => {
    console.log('Server reset requested - clearing all state');
    if (currentMatch) {
      currentMatch.abort();
      currentMatch = null;
    }
    // Emit reset event to all clients
    io.emit('serverReset', { message: 'Server state has been reset' });
    io.emit('matchPhase', { phase: 'waiting' });
    io.emit('spectatorCount', spectatorCount);
    console.log('Server state cleared. Ready for new matches.');
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    spectatorCount--;
    console.log(`Spectator disconnected (${spectatorCount} watching)`);
    io.emit('spectatorCount', spectatorCount);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          ⚓ AI BATTLESHIP ARENA - WEB SERVER ⚓               ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║   Server running at: http://localhost:${PORT}                   ║
║                                                              ║
║   Open in browser to watch AI battles in 3D!                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
});
