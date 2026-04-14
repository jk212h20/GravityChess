<script lang="ts">
  import { onMount } from 'svelte';
  import { getSocket } from '$lib/socket';
  import type { SpectatorViewState } from '$lib/game';

  let whiteClaimed = $state(false);
  let blackClaimed = $state(false);

  onMount(() => {
    const socket = getSocket();
    socket.emit('join', 'spectator');

    socket.on('spectatorState', (state: SpectatorViewState) => {
      whiteClaimed = state.whiteClaimed;
      blackClaimed = state.blackClaimed;
    });

    return () => {
      socket.off('spectatorState');
    };
  });
</script>

<svelte:head>
  <title>Gravity Chess</title>
</svelte:head>

<div class="landing">
  <div class="logo">
    <span class="icon">🪨</span>
    <h1>Gravity Chess</h1>
    <p class="subtitle">Chess where pieces fall</p>
  </div>

  <div class="rules-brief">
    <p>Standard chess pieces on a board rotated 90°. After every move, <strong>gravity pulls all pieces toward the h-file</strong>. A move is only legal if your king isn't in check <em>after</em> pieces fall. No castling, no en passant.</p>
  </div>

  <div class="roles">
    <a
      href="/white"
      class="role-btn white"
      class:claimed={whiteClaimed}
    >
      <span class="piece">♔</span>
      <span class="label">White</span>
      {#if whiteClaimed}
        <span class="status">Joined</span>
      {/if}
    </a>

    <a
      href="/black"
      class="role-btn black"
      class:claimed={blackClaimed}
    >
      <span class="piece">♚</span>
      <span class="label">Black</span>
      {#if blackClaimed}
        <span class="status">Joined</span>
      {/if}
    </a>

    <a href="/table" class="role-btn spectate-btn">
      <span class="piece">👁</span>
      <span class="label">Spectate</span>
    </a>
  </div>

  <div class="rules-detail">
    <h3>How It Works</h3>
    <div class="rule-grid">
      <div class="rule-card">
        <span class="rule-icon">🔄</span>
        <strong>Rotated Board</strong>
        <p>Pieces start on their normal squares, but the board is turned sideways. Ranks run left-to-right.</p>
      </div>
      <div class="rule-card">
        <span class="rule-icon">🪨</span>
        <strong>Gravity</strong>
        <p>After every move, all pieces fall toward the h-file. Moving a piece that supports others causes them to fall too.</p>
      </div>
      <div class="rule-card">
        <span class="rule-icon">👑</span>
        <strong>Post-Fall Legality</strong>
        <p>A move is only legal if your king is safe <em>after</em> gravity resolves. Think ahead!</p>
      </div>
      <div class="rule-card">
        <span class="rule-icon">🚫</span>
        <strong>No Castling / En Passant</strong>
        <p>Castling is impossible — gravity would disrupt it. En passant is removed for clarity.</p>
      </div>
    </div>
  </div>
</div>

<style>
  .landing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    gap: 2.5rem;
    padding: 2rem;
  }

  .logo {
    text-align: center;
  }

  .logo .icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .logo h1 {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #fff;
  }

  .subtitle {
    font-size: 1.1rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .rules-brief {
    max-width: 500px;
    text-align: center;
    color: #aaa;
    font-size: 0.95rem;
    line-height: 1.6;
    background: rgba(255, 255, 255, 0.03);
    padding: 1rem 1.5rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .rules-brief strong {
    color: #60a5fa;
  }

  .roles {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .role-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 2.5rem;
    border-radius: 12px;
    text-decoration: none;
    color: #fff;
    font-weight: 700;
    transition: transform 0.15s, box-shadow 0.15s;
    min-width: 140px;
  }

  .role-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .role-btn:active {
    transform: translateY(0);
  }

  .role-btn .piece {
    font-size: 3rem;
  }

  .role-btn .label {
    font-size: 1.2rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .role-btn .status {
    font-size: 0.75rem;
    color: #4ade80;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .white {
    background: linear-gradient(135deg, #e8e8e8 0%, #c0c0c0 100%);
    color: #1a1a1a;
  }

  .white.claimed {
    background: linear-gradient(135deg, #a0a0a0 0%, #808080 100%);
  }

  .black {
    background: linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%);
    border: 1px solid #333;
  }

  .black.claimed {
    background: linear-gradient(135deg, #2a2a2a 0%, #111 100%);
  }

  .spectate-btn {
    background: linear-gradient(135deg, #1a2a3a 0%, #0d1828 100%);
    border: 1px solid #2a3a5a;
  }

  .rules-detail {
    max-width: 700px;
    width: 100%;
  }

  .rules-detail h3 {
    text-align: center;
    font-size: 1.1rem;
    color: #888;
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .rule-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  .rule-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 1rem;
    text-align: center;
  }

  .rule-icon {
    font-size: 1.5rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .rule-card strong {
    display: block;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
    color: #ddd;
  }

  .rule-card p {
    font-size: 0.75rem;
    color: #888;
    line-height: 1.4;
  }
</style>
