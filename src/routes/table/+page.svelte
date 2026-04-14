<script lang="ts">
  import { onMount } from 'svelte';
  import ChessBoard from '$lib/ChessBoard.svelte';
  import type { SpectatorViewState } from '$lib/game';

  let gameState: SpectatorViewState | null = $state(null);

  onMount(() => {
    import('$lib/socket').then(({ getSocket }) => {
      const socket = getSocket();
      socket.emit('join', 'spectator');

      socket.on('spectatorState', (s: SpectatorViewState) => {
        gameState = s;
      });
    });
  });
</script>

<svelte:head>
  <title>Gravity Chess — Spectator</title>
</svelte:head>

<div class="spectator-page">
  <a href="/" class="back-link">← Back</a>
  <h1 class="spectator-title">👁 Spectating</h1>
  <ChessBoard {gameState} player="white" isPlayer={false} />
</div>

<style>
  .spectator-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
  }

  .back-link {
    align-self: flex-start;
    color: #666;
    text-decoration: none;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
  }

  .back-link:hover {
    color: #aaa;
  }

  .spectator-title {
    font-size: 1.3rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: #888;
  }
</style>
