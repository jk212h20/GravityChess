# Gravity Chess — Project Brief

## What Is It
A chess variant where the board is rotated 90° and gravity pulls all pieces toward the h-file after every move. Standard chess pieces and movement rules, but legality is checked *after* gravity resolves.

## Core Rules
- Standard chess starting position, board displayed rotated 90° (ranks left-to-right, files top-to-bottom, h-file at bottom)
- After every move, gravity pulls all pieces toward h-file (pieces "fall" to fill gaps)
- A move is legal only if the player's king is NOT in check after gravity resolves
- Supporting pieces moving causes cascading falls
- **No castling** (gravity makes it impossible)
- **No en passant** (too confusing with gravity)
- Checkmate wins, stalemate draws

## Tech Stack
- **Frontend:** SvelteKit 2 + Svelte 5 (runes mode)
- **Server:** Node.js + Socket.io (real-time multiplayer)
- **Build:** Vite 8, adapter-node
- **Deployment:** Railway

## URLs
- **Production:** https://gravitychess-production.up.railway.app
- **GitHub:** https://github.com/jk212h20/GravityChess

## Architecture
Two-player game over Socket.io. Players join as white/black, spectators can watch. Game state lives server-side, clients receive view-specific state.
