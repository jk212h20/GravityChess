# Gravity Chess — Active Context

## Current State (2026-04-14)
- **Status:** Initial build deployed to Railway
- **Production URL:** https://gravitychess-production.up.railway.app
- **GitHub:** https://github.com/jk212h20/GravityChess

## Architecture
| File | Purpose |
|------|---------|
| `src/lib/game.ts` | Gravity chess engine — movement, gravity, legality, check/checkmate |
| `src/lib/ChessBoard.svelte` | Board component — rotated 90° display, interaction |
| `src/lib/socket.ts` | Socket.io client singleton |
| `src/hooks.server.ts` | Socket.io dev server (attaches to Vite's httpServer) |
| `server.js` | Production server (Socket.io + SvelteKit handler) |
| `src/routes/white/` | White player page |
| `src/routes/black/` | Black player page |
| `src/routes/table/` | Spectator page |
| `src/routes/+page.svelte` | Landing/lobby page |

## Key Patterns
- **Gravity:** `applyGravity(board)` — for each row, pieces slide toward col 7 (h-file)
- **Legality:** Move raw → apply gravity → check if king safe on post-gravity board
- **Board display:** Rotated 90° — visual rows = files (a top, h bottom), visual cols = ranks (1 left, 8 right for white)
- **Black view:** Flipped both axes (ranks 8→1 left-to-right, files h→a top-to-bottom)
- **Socket events:** `join`, `move`, `newGame`

## Railway
- **Project ID:** 9a52d868-512b-48bd-8838-5da0376af832
- **Service ID:** 9cfa4d1c-b2b2-4a76-8fa1-dc40d3b48b1f
- **Build:** `npm run build` → `npm start` (runs server.js)

## What's Not Built Yet
- Sound effects (files exist but not wired up)
- Draw by repetition / 50-move rule
- Room/lobby system (single global game)
- Mobile touch optimization
- Pawn two-square move may need revisiting (gravity changes starting row)
- AI opponent
