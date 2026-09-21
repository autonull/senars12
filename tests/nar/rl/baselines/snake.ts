import type { Direction, SnakeGame } from '@senars/nar/game/SnakeGame.js';

/** Flood-fill survival heuristic: prefer apple-catching moves that keep escape room. */
export function snakeHeuristicAction(game: SnakeGame): Direction {
  const state = game.state();
  const legal = game.legalActions(state);
  if (legal.length === 0) throw new Error('snake: no legal actions');

  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const action of legal) {
    const probe = game.clone();
    const outcome = probe.step(action);
    if (outcome.terminal) continue;
    const s = probe.state();
    const head = s.snake[0]!;
    const dist = Math.abs(head.r - s.apple.r) + Math.abs(head.c - s.apple.c);
    const space = floodFill(probe, head);
    const score = outcome.reward * 100 + space * 0.01 - dist * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

function floodFill(game: SnakeGame, start: { r: number; c: number }): number {
  const snake = new Set(game.state().snake.map((s) => `${s.r},${s.c}`));
  const seen = new Set<string>([`${start.r},${start.c}`]);
  const queue = [start];
  let count = 0;
  while (queue.length > 0 && count < 256) {
    const cur = queue.pop()!;
    count++;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const r = cur.r + dr;
      const c = cur.c + dc;
      const key = `${r},${c}`;
      if (r < 0 || c < 0 || r >= game.height || c >= game.width) continue;
      if (snake.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ r, c });
    }
  }
  return count;
}
