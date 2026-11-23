import type { Game, GameOutcome, Perception } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';
import { SeededRNG } from '@senars/util/random';

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

export interface TicTacToeConfig extends GameConfig {
  /** Opponent policy for O: random (default) or perfect minimax. */
  opponent?: 'random' | 'minimax';
}

const LINES: Array<[number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const winnerOf = (board: CellValue[]): Player | 'draw' | null => {
  for (const [a, b, c] of LINES)
    if (board[a] !== '.' && board[a] === board[b] && board[b] === board[c])
      return board[a] as Player;
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

export class TicTacToeGame extends GameBase<TicTacToeState, TicTacToeAction> {
  private readonly opponent: 'random' | 'minimax';
  private board: CellValue[];
  private turn: Player;
  private terminal: boolean;
  private winner: Player | 'draw' | null;

  constructor(config: TicTacToeConfig = {}) {
    super(config.id ?? 'tictactoe', config);
    this.opponent = config.opponent ?? 'random';
    this.board = Array(9).fill('.') as CellValue[];
    this.turn = 'X';
    this.terminal = false;
    this.winner = null;
  }

  protected override getInitialState(): TicTacToeState {
    return {
      board: Array(9).fill('.') as CellValue[],
      turn: 'X',
      terminal: false,
      winner: null,
    };
  }

  protected override getStateId(state: TicTacToeState): string {
    return state.board.join('');
  }

  override step(action: TicTacToeAction): GameOutcome {
    if (this.terminal || this.turn !== 'X' || this.board[action] !== '.') {
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };
    }

    this.board[action] = 'X';
    this.incrementStep();
    let outcome = this.settle();
    if (outcome) return outcome;

    // Opponent (O) moves as part of the environment
    const open = this.board.map((v, i) => (v === '.' ? i : -1)).filter((i) => i >= 0);
    const move =
      this.opponent === 'minimax'
        ? minimax([...this.board], 'O').action
        : open[this.rng.nextInt(open.length)]!;
    this.board[move] = 'O';
    outcome = this.settle();
    return outcome ?? { reward: 0, terminal: false };
  }

  private settle(): GameOutcome | null {
    const winner = winnerOf(this.board);
    if (winner === null) return null;
    this.terminal = true;
    this.winner = winner;
    return { reward: winner === 'X' ? 1 : winner === 'draw' ? 0 : -1, terminal: true };
  }

  override isTerminal(_state: TicTacToeState): boolean {
    return this.terminal;
  }

  override legalActions(_state: TicTacToeState): TicTacToeAction[] {
    if (this.terminal || this.turn !== 'X') return [];
    return this.board.map((v, i) => (v === '.' ? i : -1)).filter((i) => i >= 0);
  }

  override state(): TicTacToeState {
    return {
      board: [...this.board],
      turn: this.turn,
      terminal: this.terminal,
      winner: this.winner,
    };
  }

  override observe(): Perception {
    const s = this.state();
    const features: Record<string, number> = {
      openCells: s.board.filter((v) => v === '.').length,
    };
    for (let i = 0; i < 9; i++)
      features[`cell${i}`] = s.board[i] === 'X' ? 1 : s.board[i] === 'O' ? 2 : 0;
    return {
      stateId: this.getStateId(s),
      features,
      confidence: 1,
      terminal: s.terminal,
    };
  }

  override reset(): TicTacToeState {
    this.board = Array(9).fill('.') as CellValue[];
    this.turn = 'X';
    this.terminal = false;
    this.winner = null;
    this.stepCount = 0;
    return this.getInitialState();
  }

  /** Deterministic board hash. */
  boardHash(): string {
    return this.board.join('');
  }

  render(): string {
    return [0, 3, 6].map((i) => this.board.slice(i, i + 3).join(' ')).join('\n');
  }

  /** Deep copy for baseline lookahead. */
  clone(): TicTacToeGame {
    const copy = new TicTacToeGame({ id: this.id, seed: 1, opponent: this.opponent });
    copy.board = [...this.board];
    copy.turn = this.turn;
    copy.terminal = this.terminal;
    copy.winner = this.winner;
    copy.stepCount = this.stepCount;
    copy.rng = new SeededRNG(this.seed);
    for (let i = 0; i < this.stepCount; i++) copy.rng.next();
    return copy;
  }
}

export function createTicTacToeGame(config: TicTacToeConfig = {}): TicTacToeGame {
  return new TicTacToeGame(config);
}