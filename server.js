import { createServer } from 'http';
import { handler } from './build/handler.js';
import { Server } from 'socket.io';

// Inline the game logic imports from the build output
const gameModule = await import('./build/server/chunks/game.js');
const { createGame, getPlayerView, getSpectatorView, playMove } = gameModule;

const PORT = parseInt(process.env.PORT || '3000');

let gameState = createGame();

const httpServer = createServer(handler);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  path: '/socket.io'
});

function broadcastState() {
  io.to('white').emit('playerState', getPlayerView(gameState, 'white'));
  io.to('black').emit('playerState', getPlayerView(gameState, 'black'));
  io.to('spectator').emit('spectatorState', getSpectatorView(gameState));
}

io.on('connection', (socket) => {
  console.log(`[GravityChess] Connected: ${socket.id}`);

  socket.on('join', (role) => {
    socket.join(role);

    if (role === 'white') {
      gameState.whiteClaimed = true;
    } else if (role === 'black') {
      gameState.blackClaimed = true;
    }

    if (gameState.whiteClaimed && gameState.blackClaimed && gameState.status === 'waiting') {
      gameState.status = 'playing';
      console.log('[GravityChess] Game started!');
    }

    broadcastState();
  });

  socket.on('move', (data) => {
    const result = playMove(
      gameState, data.player,
      data.fromR, data.fromC, data.toR, data.toC,
      data.promotion
    );
    if (result.success) {
      broadcastState();
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('newGame', () => {
    console.log('[GravityChess] New game!');
    gameState = createGame();
    gameState.status = 'playing';
    broadcastState();
  });

  socket.on('disconnect', () => {
    console.log(`[GravityChess] Disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[GravityChess] Server running on port ${PORT}`);
});
