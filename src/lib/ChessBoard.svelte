<script lang="ts">
  import { onMount } from 'svelte';
  import type { Player, PublicGameState, SpectatorViewState, Board, AnimationData } from '$lib/game';
  import { CODE_TO_PIECE } from '$lib/game';
  import { getLegalMoves } from '$lib/game';

  let {
    gameState,
    player = 'white' as Player,
    isPlayer = true,
  }: {
    gameState: PublicGameState | SpectatorViewState | null;
    player?: Player;
    isPlayer?: boolean;
  } = $props();

  let selectedSquare: [number, number] | null = $state(null);
  let legalMoves: [number, number][] = $state([]);
  let promotionChoice: { fromR: number; fromC: number; toR: number; toC: number } | null = $state(null);

  // Animation state
  let displayBoard: Board = $state(Array(8).fill(null).map(() => Array(8).fill(null)));
  let animPhase: 'idle' | 'move' | 'pause' | 'fall' = $state('idle');
  let animData: AnimationData | null = $state(null);
  let prevMoveCount = $state(0);
  let inputLocked = $state(false);

  // Track piece positions for CSS transitions: key = "piece-id", value = {vRow, vCol}
  // We use a unique ID per board cell based on piece + position
  type PiecePos = { piece: string; vRow: number; vCol: number; id: string };
  let piecePositions: PiecePos[] = $state([]);
  let fallTransitions: Map<string, { fromVRow: number; fromVCol: number; toVRow: number; toVCol: number }> = $state(new Map());

  function emit(event: string, data?: any) {
    import('$lib/socket').then(({ getSocket }) => getSocket().emit(event, data));
  }

  const isMyTurn = $derived(isPlayer && gameState && 'player' in gameState && gameState.turn === gameState.player);
  const legalMoveSet = $derived(new Set(legalMoves.map(([r, c]) => `${r},${c}`)));

  // Board coordinate mapping (white always on left, h-file at bottom)
  function visualToBoard(vRow: number, vCol: number): [number, number] {
    const boardRow = 7 - vCol;
    const boardCol = vRow;
    return [boardRow, boardCol];
  }

  function boardToVisual(boardRow: number, boardCol: number): [number, number] {
    const vRow = boardCol;
    const vCol = 7 - boardRow;
    return [vRow, vCol];
  }

  function getRankLabel(vCol: number): string {
    return String(vCol + 1);
  }

  function getFileLabel(vRow: number): string {
    return String.fromCharCode(97 + vRow);
  }

  // Build piece list from a board
  function boardToPieces(board: Board): PiecePos[] {
    const pieces: PiecePos[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c]) {
          const [vRow, vCol] = boardToVisual(r, c);
          pieces.push({ piece: board[r][c]!, vRow, vCol, id: `${board[r][c]}-${r}-${c}` });
        }
      }
    }
    return pieces;
  }

  // React to gameState changes - handle animation
  $effect(() => {
    if (!gameState) return;
    const gs = gameState;
    const moveCount = gs.moveLog.length;

    // Check if a new move happened
    if (moveCount > prevMoveCount && gs.animation?.preGravityBoard && gs.animation.lastMoveFromR >= 0) {
      prevMoveCount = moveCount;
      animData = gs.animation;
      runAnimation(gs.board, gs.animation);
    } else {
      // No animation needed (initial state, new game, etc.)
      prevMoveCount = moveCount;
      displayBoard = gs.board;
      piecePositions = boardToPieces(gs.board);
      fallTransitions = new Map();
      animPhase = 'idle';
      inputLocked = false;
    }
  });

  async function runAnimation(finalBoard: Board, anim: AnimationData) {
    inputLocked = true;
    const preGravBoard = anim.preGravityBoard!;

    // Phase 1: Show pre-gravity board (piece already at target after raw move)
    // The piece has moved from fromR,fromC to toR,toC
    animPhase = 'move';
    displayBoard = preGravBoard;
    piecePositions = boardToPieces(preGravBoard);
    fallTransitions = new Map();

    // Phase 2: Pause for 500ms so user sees the raw move
    await sleep(500);

    // Phase 3: Compute fall transitions (pre-gravity → post-gravity)
    animPhase = 'fall';
    const transitions = new Map<string, { fromVRow: number; fromVCol: number; toVRow: number; toVCol: number }>();

    // For each row, pieces shift toward col 7. Match pieces by row + identity.
    for (let row = 0; row < 8; row++) {
      // Collect pre-gravity pieces in this row (with their columns)
      const prePieces: { piece: string; col: number }[] = [];
      for (let col = 0; col < 8; col++) {
        if (preGravBoard[row][col]) {
          prePieces.push({ piece: preGravBoard[row][col]!, col });
        }
      }
      // Collect post-gravity pieces in this row
      const postPieces: { piece: string; col: number }[] = [];
      for (let col = 0; col < 8; col++) {
        if (finalBoard[row][col]) {
          postPieces.push({ piece: finalBoard[row][col]!, col });
        }
      }
      // Match them 1:1 (same order, same pieces, just shifted)
      for (let i = 0; i < prePieces.length && i < postPieces.length; i++) {
        const pre = prePieces[i];
        const post = postPieces[i];
        if (pre.col !== post.col) {
          const [fromVRow, fromVCol] = boardToVisual(row, pre.col);
          const [toVRow, toVCol] = boardToVisual(row, post.col);
          const key = `${pre.piece}-${row}-${pre.col}`;
          transitions.set(key, { fromVRow, fromVCol, toVRow, toVCol });
        }
      }
    }

    fallTransitions = transitions;

    // Show pieces at pre-gravity positions but with CSS transitions to post-gravity
    // After transition completes, snap to final board
    await sleep(350);

    // Phase 4: Snap to final
    displayBoard = finalBoard;
    piecePositions = boardToPieces(finalBoard);
    fallTransitions = new Map();
    animPhase = 'idle';
    inputLocked = false;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function handleSquareClick(vRow: number, vCol: number) {
    if (inputLocked) return;
    if (!gameState || gameState.status !== 'playing') return;
    if (!isPlayer || !('player' in gameState)) return;

    const ps = gameState as PublicGameState;
    const color = ps.player === 'white' ? 'w' : 'b';
    const [r, c] = visualToBoard(vRow, vCol);
    const cell = ps.board[r][c];

    if (selectedSquare && legalMoveSet.has(`${r},${c}`)) {
      const [fromR, fromC] = selectedSquare;
      const piece = ps.board[fromR][fromC];
      if (piece && piece[1] === 'P') {
        const promoRow = color === 'w' ? 0 : 7;
        if (r === promoRow) {
          promotionChoice = { fromR, fromC, toR: r, toC: c };
          return;
        }
      }
      emit('move', { player: ps.player, fromR, fromC, toR: r, toC: c });
      selectedSquare = null;
      legalMoves = [];
      return;
    }

    if (cell && cell[0] === color && isMyTurn) {
      selectedSquare = [r, c];
      legalMoves = getLegalMoves(ps.board, ps.player, r, c);
      return;
    }

    selectedSquare = null;
    legalMoves = [];
  }

  function handlePromotion(piece: 'Q' | 'R' | 'B' | 'N') {
    if (!promotionChoice || !gameState || !('player' in gameState)) return;
    emit('move', {
      player: (gameState as PublicGameState).player,
      ...promotionChoice,
      promotion: piece
    });
    promotionChoice = null;
    selectedSquare = null;
    legalMoves = [];
  }

  function handleNewGame() {
    emit('newGame');
  }

  function isLightSquare(boardRow: number, boardCol: number): boolean {
    return (boardRow + boardCol) % 2 === 0;
  }

  const lastMove = $derived(gameState?.moveLog.length ? gameState.moveLog[gameState.moveLog.length - 1] : null);

  function boardToSquareName(r: number, c: number): string {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    return `${files[c]}${ranks[r]}`;
  }
</script>

<div class="game-container">
  <!-- Status bar top -->
  <div class="status-bar">
    {#if gameState && 'inCheck' in gameState && (gameState as PublicGameState).inCheck}
      <span class="check-warning">⚡ CHECK!</span>
    {/if}
    {#if gameState?.status === 'finished'}
      <div class="game-over">
        <span class="winner">
          {#if gameState.winner === 'white'}♔ White wins!{:else if gameState.winner === 'black'}♚ Black wins!{:else}Draw — {(gameState as any).drawReason || 'Stalemate'}{/if}
        </span>
        <button class="new-game-btn" onclick={handleNewGame}>New Game</button>
      </div>
    {:else if gameState?.status === 'waiting'}
      <span class="waiting">Waiting for opponent...</span>
    {:else if isMyTurn && !inputLocked}
      <span class="your-turn">Your turn</span>
    {:else if inputLocked}
      <span class="opponent-turn">...</span>
    {:else if gameState}
      <span class="opponent-turn">Opponent's turn</span>
    {/if}
  </div>

  <!-- Board -->
  <div class="board-area">
    <!-- Rank labels top -->
    <div class="rank-labels top">
      <div class="label-spacer"></div>
      {#each Array(8) as _, vCol}
        <span class="rank-label">{getRankLabel(vCol)}</span>
      {/each}
    </div>

    <div class="board-with-files">
      <!-- File labels left -->
      <div class="file-labels">
        {#each Array(8) as _, vRow}
          <span class="file-label">{getFileLabel(vRow)}</span>
        {/each}
      </div>

      <!-- The board grid -->
      <div class="board">
        <!-- Square backgrounds (always visible) -->
        {#each Array(8) as _, vRow}
          {#each Array(8) as _, vCol}
            {@const [r, c] = visualToBoard(vRow, vCol)}
            {@const isLight = isLightSquare(r, c)}
            {@const isSelected = selectedSquare?.[0] === r && selectedSquare?.[1] === c}
            {@const isLegal = legalMoveSet.has(`${r},${c}`)}
            {@const sqName = boardToSquareName(r, c)}
            {@const isLastFrom = lastMove?.from === sqName}
            {@const isLastTo = lastMove?.to === sqName}

            <button
              class="square"
              class:light={isLight}
              class:dark={!isLight}
              class:selected={isSelected}
              class:last-from={isLastFrom && animPhase === 'idle'}
              class:last-to={isLastTo && animPhase === 'idle'}
              style="grid-row: {vRow + 1}; grid-column: {vCol + 1};"
              onclick={() => handleSquareClick(vRow, vCol)}
            >
              {#if isLegal && !displayBoard[r]?.[c]}
                <div class="legal-dot"></div>
              {/if}
            </button>
          {/each}
        {/each}

        <!-- Piece layer (absolutely positioned, animated) -->
        {#each piecePositions as pp (pp.id)}
          {@const fallData = fallTransitions.get(pp.id)}
          {@const actualVRow = fallData ? fallData.fromVRow : pp.vRow}
          {@const actualVCol = fallData ? fallData.fromVCol : pp.vCol}
          {@const targetVRow = fallData ? fallData.toVRow : pp.vRow}
          {@const targetVCol = fallData ? fallData.toVCol : pp.vCol}
          {@const [r, c] = visualToBoard(pp.vRow, pp.vCol)}
          {@const isLegal = legalMoveSet.has(`${r},${c}`)}

          <div
            class="piece-wrapper"
            class:falling={animPhase === 'fall' && fallData}
            style="
              --from-row: {actualVRow};
              --from-col: {actualVCol};
              --to-row: {targetVRow};
              --to-col: {targetVCol};
              grid-row: {pp.vRow + 1};
              grid-column: {pp.vCol + 1};
            "
          >
            <img
              src={`/pieces/${pp.piece}.svg`}
              alt={pp.piece}
              class="piece"
            />
            {#if isLegal}
              <div class="capture-ring"></div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Gravity indicator -->
    <div class="gravity-indicator">
      <span class="gravity-arrow">⬇</span>
      <span class="gravity-label">gravity</span>
    </div>
  </div>

  <!-- Promotion dialog -->
  {#if promotionChoice && gameState && 'player' in gameState}
    {@const color = (gameState as PublicGameState).player === 'white' ? 'w' : 'b'}
    <div class="promotion-overlay" role="dialog">
      <div class="promotion-dialog">
        <p>Promote pawn to:</p>
        <div class="promotion-options">
          {#each ['Q', 'R', 'B', 'N'] as p}
            <button class="promo-btn" onclick={() => handlePromotion(p as any)}>
              <img src={`/pieces/${color}${p}.svg`} alt={CODE_TO_PIECE[p]} />
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Move log -->
  {#if gameState && gameState.moveLog.length > 0}
    <div class="move-log">
      {#each gameState.moveLog as move}
        <span class="move-entry">
          {move.description}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .game-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    width: 100%;
    justify-content: center;
    min-height: 44px;
  }

  .check-warning { font-size: 0.85rem; color: #fbbf24; font-weight: 700; }
  .your-turn { color: #4ade80; font-weight: 700; font-size: 0.95rem; }
  .opponent-turn { color: #888; font-size: 0.9rem; }
  .waiting { color: #fbbf24; font-size: 0.9rem; animation: pulse 2s infinite; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .game-over { display: flex; align-items: center; gap: 1rem; }
  .winner { font-size: 1.1rem; font-weight: 800; color: #fbbf24; }

  .new-game-btn {
    padding: 6px 16px;
    background: #4ade80;
    color: #0a0a0a;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .board-area {
    width: 100%;
    max-width: 560px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .rank-labels.top {
    display: flex;
    width: 100%;
    padding-left: 24px;
    margin-bottom: 2px;
  }

  .label-spacer { width: 0; }

  .rank-label {
    flex: 1;
    text-align: center;
    font-size: 0.7rem;
    color: #666;
    font-weight: 600;
  }

  .board-with-files {
    display: flex;
    width: 100%;
  }

  .file-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    padding-right: 4px;
    width: 20px;
  }

  .file-label {
    font-size: 0.7rem;
    color: #666;
    font-weight: 600;
    text-align: center;
  }

  .board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(8, 1fr);
    flex: 1;
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    position: relative;
  }

  .square {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.15s;
    z-index: 1;
  }

  .light { background: #e8dcc8; }
  .dark { background: #a67c52; }
  .square.selected { background: #7bc86c !important; }
  .square.last-from, .square.last-to { background: #cdd26a !important; }

  .piece-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
  }

  .piece-wrapper.falling {
    animation: fallDown 300ms ease-in forwards;
  }

  @keyframes fallDown {
    from {
      transform: translate(
        calc((var(--from-col) - var(--to-col)) * 100%),
        calc((var(--from-row) - var(--to-row)) * 100%)
      );
    }
    to {
      transform: translate(0, 0);
    }
  }

  .piece {
    width: 78%;
    height: 78%;
    object-fit: contain;
    pointer-events: none;
  }

  .legal-dot {
    width: 28%;
    height: 28%;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }

  .capture-ring {
    position: absolute;
    inset: 4%;
    border-radius: 50%;
    border: 4px solid rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }

  .gravity-indicator {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 6px;
    color: #666;
    font-size: 0.75rem;
    padding-left: 24px;
  }

  .gravity-arrow { font-size: 1rem; color: #888; }
  .gravity-label { text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }

  .promotion-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .promotion-dialog {
    background: #1a1a2e;
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    border: 1px solid #333;
  }

  .promotion-dialog p { margin-bottom: 1rem; font-size: 1rem; }
  .promotion-options { display: flex; gap: 0.75rem; }

  .promo-btn {
    padding: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    transition: background 0.15s;
  }

  .promo-btn:hover { background: rgba(255, 255, 255, 0.2); }
  .promo-btn img { width: 48px; height: 48px; }

  .move-log {
    width: 100%;
    max-height: 120px;
    overflow-y: auto;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .move-entry {
    font-size: 0.75rem;
    color: #888;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
  }
</style>
