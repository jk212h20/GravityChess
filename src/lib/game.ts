// Gravity Chess Engine
// Standard chess piece movement, but after every move gravity pulls all pieces
// toward the h-file. A move is legal only if the player's king is NOT in check
// after gravity resolves. No castling, no en passant.

export type Player = 'white' | 'black';
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Move {
  player: Player;
  description: string;
  moveNumber: number;
  from?: string;
  to?: string;
}

export type BoardCell = string | null; // 'wK', 'bP', etc. or null
export type Board = BoardCell[][];

export interface GameState {
  board: Board;
  preGravityBoard: Board | null; // board after raw move, before gravity
  lastMoveFromR: number;
  lastMoveFromC: number;
  lastMoveToR: number;
  lastMoveToC: number;
  turn: Player;
  moveLog: Move[];
  status: GameStatus;
  winner: Player | null;
  whiteClaimed: boolean;
  blackClaimed: boolean;
  drawReason: string | null;
}

// --- Constants ---
// Internal board: board[row][col]
// row 0 = rank 8, row 7 = rank 1
// col 0 = file a, col 7 = file h
// Gravity pulls toward h-file (col 7 = "down")

export const FILES_ARR = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS_ARR = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const CODE_TO_PIECE: Record<string, string> = {
  K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn',
};

export const PIECE_VALUES: Record<string, number> = {
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0,
};

// --- Board ---

export function makeStartingBoard(): Board {
  // Standard chess starting position
  // board[0] = rank 8 (black back rank), board[7] = rank 1 (white back rank)
  const board: Board = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'], // rank 8
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'], // rank 7
    [null, null, null, null, null, null, null, null],       // rank 6
    [null, null, null, null, null, null, null, null],       // rank 5
    [null, null, null, null, null, null, null, null],       // rank 4
    [null, null, null, null, null, null, null, null],       // rank 3
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'], // rank 2
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'], // rank 1
  ];
  // Apply gravity to starting position (pieces fall toward h-file = col 7)
  return applyGravity(board);
}

function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

export function squareToIndices(file: string, rank: string): [number, number] {
  const col = FILES_ARR.indexOf(file);
  const row = RANKS_ARR.indexOf(rank);
  return [row, col];
}

export function indicesToSquare(row: number, col: number): string {
  return `${FILES_ARR[col]}${RANKS_ARR[row]}`;
}

// --- Gravity ---
// Gravity pulls pieces toward h-file (col 7).
// For each row, pieces slide toward col 7, filling from right to left.

export function applyGravity(board: Board): Board {
  const result = cloneBoard(board);
  for (let row = 0; row < 8; row++) {
    // Collect all pieces in this row
    const pieces: BoardCell[] = [];
    for (let col = 0; col < 8; col++) {
      if (result[row][col] !== null) {
        pieces.push(result[row][col]);
      }
    }
    // Clear the row
    for (let col = 0; col < 8; col++) {
      result[row][col] = null;
    }
    // Place pieces packed toward col 7 (h-file)
    let placeCol = 7;
    for (let i = pieces.length - 1; i >= 0; i--) {
      result[row][placeCol] = pieces[i];
      placeCol--;
    }
  }
  return result;
}

// --- Game Init ---

export function createGame(): GameState {
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

// --- Path checking ---

function isPathClear(board: Board, fromR: number, fromC: number, toR: number, toC: number): boolean {
  const dr = Math.sign(toR - fromR);
  const dc = Math.sign(toC - fromC);
  let r = fromR + dr;
  let c = fromC + dc;
  while (r !== toR || c !== toC) {
    if (board[r][c] !== null) return false;
    r += dr;
    c += dc;
  }
  return true;
}

// --- Piece movement (raw — does NOT check king safety or gravity) ---

function canPieceMove(board: Board, pieceCode: string, fromR: number, fromC: number, toR: number, toC: number): boolean {
  const pieceType = pieceCode[1]; // K, Q, R, B, N, P
  const color = pieceCode[0];    // w or b
  const target = board[toR][toC];

  // Can't move to same square
  if (fromR === toR && fromC === toC) return false;

  // Can't capture own piece
  if (target && target[0] === color) return false;

  const dr = toR - fromR;
  const dc = toC - fromC;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  switch (pieceType) {
    case 'K':
      return absDr <= 1 && absDc <= 1 && (absDr + absDc > 0);

    case 'Q':
      if (absDr === 0 || absDc === 0 || absDr === absDc)
        return isPathClear(board, fromR, fromC, toR, toC);
      return false;

    case 'R':
      if (absDr === 0 || absDc === 0)
        return isPathClear(board, fromR, fromC, toR, toC);
      return false;

    case 'B':
      if (absDr === absDc && absDr > 0)
        return isPathClear(board, fromR, fromC, toR, toC);
      return false;

    case 'N':
      return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);

    case 'P': {
      // Standard pawn movement (vertical in notation terms)
      // White pawns move "up" = toward row 0 (rank 8)
      // Black pawns move "down" = toward row 7 (rank 1)
      const direction = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;

      // Forward move (no capture) — along the row axis
      if (dc === 0 && target === null) {
        if (dr === direction) return true;
        if (dr === 2 * direction && fromR === startRow && board[fromR + direction][fromC] === null) return true;
      }
      // Capture (diagonal)
      if (absDc === 1 && dr === direction && target !== null && target[0] !== color) {
        return true;
      }
      return false;
    }

    default:
      return false;
  }
}

// --- Check Detection (on a given board, no gravity applied) ---

export function isInCheck(board: Board, player: Player): boolean {
  const color = player === 'white' ? 'w' : 'b';
  const kingCode = `${color}K`;

  // Find king
  let kingR = -1, kingC = -1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === kingCode) {
        kingR = r; kingC = c; break;
      }
    }
    if (kingR !== -1) break;
  }
  if (kingR === -1) return false;

  // Check if any opponent piece attacks the king
  const opponentColor = player === 'white' ? 'b' : 'w';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell[0] === opponentColor) {
        if (canPieceMove(board, cell, r, c, kingR, kingC)) {
          return true;
        }
      }
    }
  }
  return false;
}

// --- Move legality with gravity ---
// A move is legal if:
// 1. The piece can make the raw chess move on the current board
// 2. After applying the move AND gravity, the player's king is not in check

function isMoveLegalWithGravity(board: Board, player: Player, fromR: number, fromC: number, toR: number, toC: number): boolean {
  const testBoard = cloneBoard(board);
  const piece = testBoard[fromR][fromC];
  testBoard[toR][toC] = piece;
  testBoard[fromR][fromC] = null;

  // Apply gravity
  const postGravity = applyGravity(testBoard);

  // Check if player's king is in check after gravity
  return !isInCheck(postGravity, player);
}

// --- Legal moves for a piece ---

export function getLegalMoves(board: Board, player: Player, fromR: number, fromC: number): [number, number][] {
  const cell = board[fromR][fromC];
  if (!cell) return [];
  const color = player === 'white' ? 'w' : 'b';
  if (cell[0] !== color) return [];

  const moves: [number, number][] = [];

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

// --- Has any legal move? ---

function hasAnyLegalMove(board: Board, player: Player): boolean {
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

// --- Checkmate / Stalemate Detection ---

export function isCheckmate(board: Board, player: Player): boolean {
  return isInCheck(board, player) && !hasAnyLegalMove(board, player);
}

export function isStalemate(board: Board, player: Player): boolean {
  return !isInCheck(board, player) && !hasAnyLegalMove(board, player);
}

// --- Move Execution ---

export interface MoveResult {
  success: boolean;
  error?: string;
}

export function playMove(
  state: GameState,
  player: Player,
  fromR: number, fromC: number,
  toR: number, toC: number,
  promotionPiece?: 'Q' | 'R' | 'B' | 'N'
): MoveResult {
  if (state.status !== 'playing') return { success: false, error: 'Game not in progress' };
  if (state.turn !== player) return { success: false, error: 'Not your turn' };

  const color = player === 'white' ? 'w' : 'b';
  const opponent: Player = player === 'white' ? 'black' : 'white';
  const cell = state.board[fromR][fromC];
  if (!cell || cell[0] !== color) return { success: false, error: 'Not your piece' };

  // Validate legal move
  const legalMoves = getLegalMoves(state.board, player, fromR, fromC);
  if (!legalMoves.some(([r, c]) => r === toR && c === toC)) {
    return { success: false, error: 'Not a legal move' };
  }

  // Build description before modifying
  const fromSq = indicesToSquare(fromR, fromC);
  const toSq = indicesToSquare(toR, toC);
  const pieceName = CODE_TO_PIECE[cell[1]];
  const captured = state.board[toR][toC];

  // Store move coordinates for animation
  state.lastMoveFromR = fromR;
  state.lastMoveFromC = fromC;
  state.lastMoveToR = toR;
  state.lastMoveToC = toC;

  // Execute raw move
  state.board[toR][toC] = cell;
  state.board[fromR][fromC] = null;

  // Pawn promotion (check before gravity — promotion row is based on raw move target)
  if (cell[1] === 'P') {
    const promoRow = color === 'w' ? 0 : 7;
    if (toR === promoRow) {
      const promo = promotionPiece || 'Q';
      state.board[toR][toC] = `${color}${promo}`;
    }
  }

  // Save pre-gravity board for animation
  state.preGravityBoard = cloneBoard(state.board);

  // Apply gravity
  state.board = applyGravity(state.board);

  // Build description
  let desc = `${pieceName} ${fromSq}→${toSq}`;
  if (captured) {
    const capturedName = CODE_TO_PIECE[captured[1]];
    desc += ` ✕ ${capturedName}`;
  }
  if (cell[1] === 'P') {
    const promoRow = color === 'w' ? 0 : 7;
    if (toR === promoRow) {
      desc += `=${promotionPiece || 'Q'}`;
    }
  }

  // Switch turn
  state.turn = opponent;

  // Check detection on opponent (on post-gravity board)
  if (isInCheck(state.board, opponent)) {
    desc += ' +CHECK';
  }

  // Log the move
  const moveNumber = state.moveLog.length + 1;
  const move: Move = {
    player,
    description: desc,
    moveNumber,
    from: fromSq,
    to: toSq,
  };
  state.moveLog.push(move);

  // Checkmate / stalemate check
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

// --- Public state views ---

export interface AnimationData {
  preGravityBoard: Board | null;
  lastMoveFromR: number;
  lastMoveFromC: number;
  lastMoveToR: number;
  lastMoveToC: number;
}

export interface PublicGameState {
  board: Board;
  turn: Player;
  player: Player;
  moveLog: Move[];
  status: GameStatus;
  winner: Player | null;
  whiteClaimed: boolean;
  blackClaimed: boolean;
  drawReason: string | null;
  inCheck: boolean;
  animation: AnimationData;
}

export function getPlayerView(state: GameState, player: Player): PublicGameState {
  return {
    board: state.board,
    turn: state.turn,
    player,
    moveLog: state.moveLog,
    status: state.status,
    winner: state.winner,
    whiteClaimed: state.whiteClaimed,
    blackClaimed: state.blackClaimed,
    drawReason: state.drawReason,
    inCheck: isInCheck(state.board, player),
    animation: {
      preGravityBoard: state.preGravityBoard,
      lastMoveFromR: state.lastMoveFromR,
      lastMoveFromC: state.lastMoveFromC,
      lastMoveToR: state.lastMoveToR,
      lastMoveToC: state.lastMoveToC,
    },
  };
}

export interface SpectatorViewState {
  board: Board;
  turn: Player;
  moveLog: Move[];
  status: GameStatus;
  winner: Player | null;
  whiteClaimed: boolean;
  blackClaimed: boolean;
  drawReason: string | null;
  animation: AnimationData;
}

export function getSpectatorView(state: GameState): SpectatorViewState {
  return {
    board: state.board,
    turn: state.turn,
    moveLog: state.moveLog,
    status: state.status,
    winner: state.winner,
    whiteClaimed: state.whiteClaimed,
    blackClaimed: state.blackClaimed,
    drawReason: state.drawReason,
    animation: {
      preGravityBoard: state.preGravityBoard,
      lastMoveFromR: state.lastMoveFromR,
      lastMoveFromC: state.lastMoveFromC,
      lastMoveToR: state.lastMoveToR,
      lastMoveToC: state.lastMoveToC,
    },
  };
}
