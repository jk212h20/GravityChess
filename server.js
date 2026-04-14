import { createServer } from 'http';
import { handler } from './build/handler.js';
import { Server } from 'socket.io';

// ========== GAME ENGINE (inlined) ==========

const FILES_ARR = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS_ARR = ['8', '7', '6', '5', '4', '3', '2', '1'];
const CODE_TO_PIECE = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function indicesToSquare(row, col) {
  return `${FILES_ARR[col]}${RANKS_ARR[row]}`;
}

function applyGravity(board) {
  const result = cloneBoard(board);
  for (let row = 0; row < 8; row++) {
    const pieces = [];
    for (let col = 0; col < 8; col++) {
      if (result[row][col] !== null) pieces.push(result[row][col]);
    }
    for (let col = 0; col < 8; col++) result[row][col] = null;
    let placeCol = 7;
    for (let i = pieces.length - 1; i >= 0; i--) {
      result[row][placeCol] = pieces[i];
      placeCol--;
    }
  }
  return result;
}

function makeStartingBoard() {
  const board = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'],
  ];
  return applyGravity(board);
}

function isPathClear(board, fromR, fromC, toR, toC) {
  const dr = Math.sign(toR - fromR);
  const dc = Math.sign(toC - fromC);
  let r = fromR + dr, c = fromC + dc;
  while (r !== toR || c !== toC) {
    if (board[r][c] !== null) return false;
    r += dr; c += dc;
  }
  return true;
}

function canPieceMove(board, pieceCode, fromR, fromC, toR, toC) {
  const pieceType = pieceCode[1];
  const color = pieceCode[0];
  const target = board[toR][toC];
  if (fromR === toR && fromC === toC) return false;
  if (target && target[0] === color) return false;
  const dr = toR - fromR, dc = toC - fromC;
  const absDr = Math.abs(dr), absDc = Math.abs(dc);

  switch (pieceType) {
    case 'K': return absDr <= 1 && absDc <= 1 && (absDr + absDc > 0);
    case 'Q': return (absDr === 0 || absDc === 0 || absDr === absDc) ? isPathClear(board, fromR, fromC, toR, toC) : false;
    case 'R': return (absDr === 0 || absDc === 0) ? isPathClear(board, fromR, fromC, toR, toC) : false;
    case 'B': return (absDr === absDc && absDr > 0) ? isPathClear(board, fromR, fromC, toR, toC) : false;
    case 'N': return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
    case 'P': {
      const direction = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      if (dc === 0 && target === null) {
        if (dr === direction) return true;
        if (dr === 2 * direction && fromR === startRow && board[fromR + direction][fromC] === null) return true;
      }
      if (absDc === 1 && dr === direction && target !== null && target[0] !== color) return true;
      return false;
    }
    default: return false;
  }
}

function isInCheck(board, player) {
  const color = player === 'white' ? 'w' : 'b';
  const kingCode = `${color}K`;
  let kingR = -1, kingC = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === kingCode) { kingR = r; kingC = c; break; }
    }
    if (kingR !== -1) break;
  }
  if (kingR === -1) return false;
  const opponentColor = player === 'white' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell[0] === opponentColor) {
        if (canPieceMove(board, cell, r, c, kingR, kingC)) return true;
      }
    }
  }
  return false;
}

function isMoveLegalWithGravity(board, player, fromR, fromC, toR, toC) {
  const testBoard = cloneBoard(board);
  testBoard[toR][toC] = testBoard[fromR][fromC];
  testBoard[fromR][fromC] = null;
  const postGravity = applyGravity(testBoard);
  return !isInCheck(postGravity, player);
}

function getLegalMoves(board, player, fromR, fromC) {
  const cell = board[fromR][fromC];
  if (!cell) return [];
  const color = player === 'white' ? 'w' : 'b';
  if (cell[0] !== color) return [];
  const moves = [];
  for (let toR = 0; toR < 8; toR++) {
    for (let toC = 0; toC < 8; toC++) {
      if (canPieceMove(board, cell, fromR, fromC, toR, toC)) {
        if (isMoveLegalWithGravity(board, player, fromR, fromC, toR, toC)) {
          moves.push([toR, toC]);
        }
      }
    }
  }
  return moves;
}

function hasAnyLegalMove(board, player) {
  const color = player === 'white' ? 'w' : 'b';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell[0] === color) {
        if (getLegalMoves(board, player, r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function isCheckmate(board, player) {
  return isInCheck(board, player) && !hasAnyLegalMove(board, player);
}

function isStalemate(board, player) {
  return !isInCheck(board, player) && !hasAnyLegalMove(board, player);
}

function createGame() {
  return {
    board: makeStartingBoard(),
    preGravityBoard: null,
    lastMoveFromR: -1,
    lastMoveFromC: -1,
    lastMoveToR: -1,
    lastMoveToC: -1,
    turn: 'white',
    moveLog: [],
    status: 'waiting',
    winner: null,
    whiteClaimed: false,
    blackClaimed: false,
    drawReason: null,
  };
}

function playMove(state, player, fromR, fromC, toR, toC, promotionPiece) {
  if (state.status !== 'playing') return { success: false, error: 'Game not in progress' };
  if (state.turn !== player) return { success: false, error: 'Not your turn' };
  const color = player === 'white' ? 'w' : 'b';
  const opponent = player === 'white' ? 'black' : 'white';
  const cell = state.board[fromR][fromC];
  if (!cell || cell[0] !== color) return { success: false, error: 'Not your piece' };
  const legalMoves = getLegalMoves(state.board, player, fromR, fromC);
  if (!legalMoves.some(([r, c]) => r === toR && c === toC)) {
    return { success: false, error: 'Not a legal move' };
  }
  const fromSq = indicesToSquare(fromR, fromC);
  const toSq = indicesToSquare(toR, toC);
  const pieceName = CODE_TO_PIECE[cell[1]];
  const captured = state.board[toR][toC];
  state.lastMoveFromR = fromR;
  state.lastMoveFromC = fromC;
  state.lastMoveToR = toR;
  state.lastMoveToC = toC;
  state.board[toR][toC] = cell;
  state.board[fromR][fromC] = null;
  if (cell[1] === 'P') {
    const promoRow = color === 'w' ? 0 : 7;
    if (toR === promoRow) {
      state.board[toR][toC] = `${color}${promotionPiece || 'Q'}`;
    }
  }
  state.preGravityBoard = cloneBoard(state.board);
  state.board = applyGravity(state.board);
  let desc = `${pieceName} ${fromSq}→${toSq}`;
  if (captured) desc += ` ✕ ${CODE_TO_PIECE[captured[1]]}`;
  if (cell[1] === 'P') {
    const promoRow = color === 'w' ? 0 : 7;
    if (toR === promoRow) desc += `=${promotionPiece || 'Q'}`;
  }
  state.turn = opponent;
  if (isInCheck(state.board, opponent)) desc += ' +CHECK';
  const moveNumber = state.moveLog.length + 1;
  const move = { player, description: desc, moveNumber, from: fromSq, to: toSq };
  state.moveLog.push(move);
  if (isCheckmate(state.board, opponent)) {
    state.status = 'finished';
    state.winner = player;
    move.description = move.description.replace('CHECK', 'CHECKMATE');
  } else if (isStalemate(state.board, opponent)) {
    state.status = 'finished';
    state.winner = null;
    state.drawReason = 'Stalemate';
  }
  return { success: true };
}

function getAnimationData(state) {
  return {
    preGravityBoard: state.preGravityBoard,
    lastMoveFromR: state.lastMoveFromR,
    lastMoveFromC: state.lastMoveFromC,
    lastMoveToR: state.lastMoveToR,
    lastMoveToC: state.lastMoveToC,
  };
}

function getPlayerView(state, player) {
  return {
    board: state.board, turn: state.turn, player,
    moveLog: state.moveLog, status: state.status,
    winner: state.winner, whiteClaimed: state.whiteClaimed,
    blackClaimed: state.blackClaimed, drawReason: state.drawReason,
    inCheck: isInCheck(state.board, player),
    animation: getAnimationData(state),
  };
}

function getSpectatorView(state) {
  return {
    board: state.board, turn: state.turn,
    moveLog: state.moveLog, status: state.status,
    winner: state.winner, whiteClaimed: state.whiteClaimed,
    blackClaimed: state.blackClaimed, drawReason: state.drawReason,
    animation: getAnimationData(state),
  };
}

// ========== SERVER ==========

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
    if (role === 'white') gameState.whiteClaimed = true;
    else if (role === 'black') gameState.blackClaimed = true;
    if (gameState.whiteClaimed && gameState.blackClaimed && gameState.status === 'waiting') {
      gameState.status = 'playing';
      console.log('[GravityChess] Game started!');
    }
    broadcastState();
  });

  socket.on('move', (data) => {
    const result = playMove(gameState, data.player, data.fromR, data.fromC, data.toR, data.toC, data.promotion);
    if (result.success) broadcastState();
    else socket.emit('error', result.error);
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
