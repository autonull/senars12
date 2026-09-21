import type { Game } from './Game.js';

/** Render any game that exposes a `render()` method; falls back to the state key. */
export function renderGame(game: Game): string {
  const r = (game as { render?: () => string }).render;
  return typeof r === 'function' ? r.call(game) : String(game.state());
}
