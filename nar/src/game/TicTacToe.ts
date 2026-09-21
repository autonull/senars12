import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export type Player = 'X' | 'O';
export type CellValue = Player | '.';
/** Board positions 0..8; legal = empty cells. */
export type TicTacToeAction = number;

export interface TicTacToeState {
  board: CellValue[];
  turn: Player;
  terminal: boolean;
  winner: Player | 'draw' | null;
}

export interface TicTacToeConfig {
  id?: string;
  seed?: number;
  /** Opponent policy for O: random (default) or perfect minimax. */
  opponent?: 'random' | 'minimax';
}

const LINES: Array<[number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const winnerOf = (board: CellValue[]): Player | 'draw' | null => {
  for (const [a, b, c] of LINES)
    if (board[a] !== '.' && board[a] === board[b] && board[b] === board[c]) return board[a] as Player;
  return board.every((v) => v !== '.') ? 'draw' : null;
};

/** Perfect-play minimax (the game-theoretic parity anchor). Scores from X's perspective. */
export function minimax(
  board: CellValue[],
  player: Player,
  cache?: Map<string, { action: number; score: number }>
): { action: number; score: number } {
  const key = `${board.join('')}|${player}`;
  const cached = cache?.get(key);
  if (cached) return cached;

  const winner = winnerOf(board);
  if (winner === 'X') return { action: -1, score: 1 };
  if (winner === 'O') return { action: -1, score: -1 };
  if (winner === 'draw') return { action: -1, score: 0 };

  const moves = board.map((v, i) => (v === '.' ? i : -1)).filter((i) => i >= 0);
  let best = { action: moves[0]!, score: player === 'X' ? -2 : 2 };
  for (const action of moves) {
    board[action] = player;
    const { score } = minimax(board, player === 'X' ? 'O' : 'X', cache);
    board[action] = '.';
    const better = player === 'X' ? score > best.score : score < best.score;
    if (better) {
      best = { action, score };
      if (player === 'X' ? score === 1 : score === -1) break;
    }
  }
  cache?.set(key, best);
  return best;
}

export class TicTacToeGame implements Game<TicTacToeState, TicTacToeAction> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private readonly opponent: 'random' | 'minimax';
  private state_: TicTacToeState;

  constructor(config: TicTacToeConfig = {}) {
    this.id = config.id ?? 'tictactoe';
    this.rng = new SeededRNG(config.seed ?? 1);
    this.opponent = config.opponent ?? 'random';
    this.state_ = { board: Array(9).fill('.') as CellValue[], turn: 'X', terminal: false, winner: null };
  }

  reset(): void {
    this.state_ = { board: Array(9).fill('.') as CellValue[], turn: 'X', terminal: false, winner: null };
  }

  /** Deep copy for baseline lookahead. */
  clone(): TicTacToeGame {
    const copy = new TicTacToeGame({ id: this.id, seed: 1, opponent: this.opponent });
    copy.state_ = { board: [...this.state_.board], turn: this.state_.turn, terminal: this.state_.terminal, winner: this.state_.winner };
    copy.rng.setState(this.rng.getState());
    return copy;
  }

  state(): TicTacToeState {
    return this.state_;
  }

  legalActions(state: TicTacToeState): TicTacToeAction[] {
    if (state.terminal || state.turn !== 'X') return [];
    return state.board.map((v, i) => (v === '.' ? i : -1)).filter((i) => i >= 0);
  }

  step(action: TicTacToeAction): GameOutcome {
    const state = this.state_;
    if (state.terminal || state.turn !== 'X' || state.board[action] !== '.')
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };

    state.board[action] = 'X';
    let outcome = this.settle();
    if (outcome) return outcome;

    // Opponent (O) moves as part of the environment
    const open = state.board.map((v, i) => (v === '.' ? i : -1)).filter((i) => i >= 0);
    const move =
      this.opponent === 'minimax'
        ? minimax([...state.board], 'O').action
        : open[this.rng.nextInt(open.length)]!;
    state.board[move] = 'O';
    outcome = this.settle();
    return outcome ?? { reward: 0, terminal: false };
  }

  private settle(): GameOutcome | null {
    const state = this.state_;
    const winner = winnerOf(state.board);
    if (winner === null) return null;
    state.terminal = true;
    state.winner = winner;
    return { reward: winner === 'X' ? 1 : winner === 'draw' ? 0 : -1, terminal: true };
  }

  observe(): Perception {
    const features: Record<string, number> = { openCells: this.state_.board.filter((v) => v === '.').length };
    for (let i = 0; i < 9; i++) features[`cell${i}`] = this.state_.board[i] === 'X' ? 1 : this.state_.board[i] === 'O' ? 2 : 0;
    return {
      stateId: this.boardHash(),
      features,
      confidence: 1,
      terminal: this.state_.terminal,
    };
  }

  /** Deterministic board hash. */
  boardHash(): string {
    return this.state_.board.join('');
  }

  render(): string {
    return [0, 3, 6]
      .map((i) => this.state_.board.slice(i, i + 3).join(' '))
      .join('\n');
  }
}

export function createTicTacToeGame(config: TicTacToeConfig = {}): TicTacToeGame {
  return new TicTacToeGame(config);
}
