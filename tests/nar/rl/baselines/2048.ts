import type { Game2048, Move2048 } from '@senars/nar/game/Game2048.js';

/** Corner/monotonicity greedy: empty cells + merge gain + max-tile-in-corner. */
export function game2048HeuristicAction(game: Game2048): Move2048 {
  const state = game.state();
  const legal = game.legalActions(state);
  if (legal.length === 0) throw new Error('2048: no legal actions');

  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const action of legal) {
    const probe = game.clone();
    const outcome = probe.step(action);
    if (outcome.terminal) continue;
    const board = probe.state().board;
    const empty = board.flat().filter((v) => v === 0).length;
    const maxTile = Math.max(...board.flat());
    const corners = [board[0]![0]!, board[0]![3]!, board[3]![0]!, board[3]![3]!];
    const cornerBonus = corners.some((v) => v === maxTile) ? maxTile / 8 : 0;
    const gained = Number(outcome.info?.gained ?? 0);
    const score = empty + gained / 8 + cornerBonus;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}
