import type { Game } from './Game.js';

/** Render any game that exposes a `render()` method; falls back to the state key. */
export function renderGame(game: Game): string {
  const r = (game as { render?: () => string }).render;
  return typeof r === 'function' ? r.call(game) : String(game.state());
}

/**
 * Render a `rows × cols` cell grid. `cell(row, col)` returns the symbol for that
 * coordinate — the shared skeleton behind every arcade board renderer.
 */
export function renderGrid(
  rows: number,
  cols: number,
  cell: (row: number, col: number) => string
): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) line += cell(r, c);
    lines.push(line);
  }
  return lines.join('\n');
}
