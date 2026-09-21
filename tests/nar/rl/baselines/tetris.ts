import type { TetrisGame, TetrisPlacement } from '@senars/nar/game/TetrisGame.js';

/** Lines-cleared + holes weight (the classic heuristic the community baseline uses). */
export function tetrisHeuristicPlacement(game: TetrisGame): TetrisPlacement {
  const placements = game.legalPlacements();
  if (placements.length === 0) throw new Error('tetris: no legal placements');

  let best = placements[0]!;
  let bestScore = -Infinity;
  for (const placement of placements) {
    const probe = game.clone();
    const outcome = probe.step(placement);
    if (outcome.terminal) continue;
    const before = game.state().linesCleared;
    const after = probe.state().linesCleared;
    const score = (after - before) * 10 - holes(probe) * 2 - bumpiness(probe) * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = placement;
    }
  }
  return best;
}

function holes(game: TetrisGame): number {
  const grid = game.state().grid;
  let holes = 0;
  for (let c = 0; c < game.width; c++) {
    let seen = false;
    for (let r = 0; r < game.height; r++) {
      if (grid[r]![c]) seen = true;
      else if (seen) holes++;
    }
  }
  return holes;
}

function bumpiness(game: TetrisGame): number {
  const grid = game.state().grid;
  const heights: number[] = [];
  for (let c = 0; c < game.width; c++) {
    let h = 0;
    for (let r = 0; r < game.height; r++)
      if (grid[r]![c]) {
        h = game.height - r;
        break;
      }
    heights.push(h);
  }
  return heights.slice(1).reduce((sum, h, i) => sum + Math.abs(h - heights[i]!), 0);
}
