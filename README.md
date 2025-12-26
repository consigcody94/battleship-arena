# AI Battleship Arena

Watch AI-powered CLI tools battle it out in classic Battleship! Supports **Claude CLI**, **Gemini CLI**, and **Codex CLI**.

```
╔══════════════════════════════════════════════════╗
║       ⚓ AI BATTLESHIP ARENA ⚓                   ║
║       Claude vs Gemini vs Codex                  ║
╚══════════════════════════════════════════════════╝
```

## Features

### Web Spectator Mode (Twitch-Ready!)
- **3D Naval Battle**: Stunning Three.js ocean with realistic waves and lighting
- **Split-Screen View**: Watch both fleets simultaneously
- **AI Trash Talk**: Each AI has a unique personality with witty commentary
- **Dramatic Effects**: Explosions, fire, smoke, and water splashes
- **Real-time Updates**: WebSocket-powered live game state

### CLI Mode
- **Visual Game Board**: Rich ASCII terminal UI with colors and box-drawing characters
- **Three AI Players**: Claude, Gemini, and Codex CLI integrations
- **AI Reasoning Display**: Watch the AIs explain their strategic thinking
- **Tournament Modes**: Round-robin, best-of series, and elimination brackets
- **Game Replays**: Save and replay matches as JSON
- **Demo Mode**: Try the UI without needing AI CLIs installed

## Installation

```bash
cd ~/battleship-arena
npm install
npm run build
```

## Prerequisites

Install at least two of these AI CLIs:

```bash
# Claude CLI
npm install -g @anthropic-ai/claude-code

# Gemini CLI
npm install -g @google/gemini-cli

# Codex CLI
npm install -g @openai/codex
```

## Usage

### Web Mode (3D Spectator Experience)

```bash
# Start the web server
npm run web

# Open in browser
# http://localhost:3000
```

Click "START DEMO" to watch AI battles with mock players, or "START MATCH" to pit real AI CLIs against each other!

### CLI Mode

### Check Available Players

```bash
npm run dev -- check
```

### Demo Mode (No AI Required)

```bash
npm run dev -- demo
```

### Quick Match

```bash
# Claude vs Gemini
npm run dev -- match --p1 claude --p2 gemini

# With custom delay between turns
npm run dev -- match --p1 claude --p2 codex --delay 1000

# Save replay to file
npm run dev -- match --p1 gemini --p2 codex --save replay.json
```

### Tournament Mode

```bash
# Round-robin tournament (everyone plays everyone)
npm run dev -- tournament --players claude,gemini,codex --rounds 2

# Best-of series (2 players only)
npm run dev -- tournament --players claude,gemini --mode best-of --best-of 5

# Elimination tournament
npm run dev -- tournament --players claude,gemini,codex --mode elimination

# Save all replays
npm run dev -- tournament --players claude,gemini,codex --save-dir ./replays
```

## Game Rules (Official Hasbro)

- **Grid**: 10x10 (columns A-J, rows 1-10)
- **Ships**:
  - Carrier (5 cells)
  - Battleship (4 cells)
  - Cruiser (3 cells)
  - Submarine (3 cells)
  - Destroyer (2 cells)
- **Win Condition**: First to sink all opponent ships

## Visual Board Legend

```
░ Water     ● Hit       ○ Miss      X Sunk
C Carrier   B Battleship   R Cruiser   S Submarine   D Destroyer
```

## Project Structure

```
battleship-arena/
├── src/
│   ├── game/           # Core game engine
│   │   ├── types.ts    # Type definitions
│   │   ├── Ship.ts     # Ship class
│   │   ├── Board.ts    # Board class
│   │   └── Game.ts     # Game orchestrator
│   ├── ai/             # AI player adapters
│   │   ├── AIPlayer.ts     # Base class
│   │   ├── ClaudePlayer.ts # Claude CLI
│   │   ├── GeminiPlayer.ts # Gemini CLI
│   │   ├── CodexPlayer.ts  # Codex CLI
│   │   └── PromptBuilder.ts # Prompt generation
│   ├── ui/             # Terminal visualization
│   │   ├── colors.ts       # Color schemes
│   │   ├── BoardRenderer.ts # Board rendering
│   │   └── MatchDisplay.ts  # Full match UI
│   ├── arena/          # Tournament system
│   │   ├── Arena.ts        # Tournament manager
│   │   ├── Match.ts        # Single match controller
│   │   └── Scoreboard.ts   # Score tracking
│   └── index.ts        # CLI entry point
└── package.json
```

## Development

```bash
# Run in development mode
npm run dev -- [command]

# Build for production
npm run build

# Watch mode
npm run watch
```

## License

MIT
