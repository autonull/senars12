import { minimax, type TicTacToeAction, type TicTacToeGame } from '@senars/nar/game/TicTacToe.js';

/** Perfect play (the game-theoretic parity anchor). Memoized across episodes. */
const cache = new Map<string, { action: number; score: number }>();

export function ticTacToeHeuristicAction(game: TicTacToeGame): TicTacToeAction {
  const legal = game.legalActions(game.state());
  if (legal.length === 0) throw new Error('tictactoe: no legal actions');
  return minimax([...game.state().board], 'X', cache).action;
}
