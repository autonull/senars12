import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export type Move2048 = 0 | 1 | 2 | 3; // left, up, right, down

export interface Game2048State {
  board: number[][];
  steps: number;
  terminal: boolean;
}

export interface Game2048Config {
  id?: string;
  size?: number;
  seed?: number;
  target?: number;
}

export class Game2048 implements Game<Game2048State, Move2048> {
  readonly id: string;
  private readonly size: number;
  private readonly target: number;
  private readonly rng: SeededRNG;
  private state_: Game2048State;

  constructor(config: Game2048Config = {}) {
    this.id = config.id ?? '2048';
    this.size = config.size ?? 4;
    this.target = config.target ?? 2048;
    this.rng = new SeededRNG(config.seed ?? 1);
    this.state_ = { board: this.emptyBoard(), steps: 0, terminal: false };
    this.spawn();
    this.spawn();
  }

  private emptyBoard(): number[][] {
    return Array.from({ length: this.size }, () => Array(this.size).fill(0));
  }

  reset(): void {
    this.state_ = { board: this.emptyBoard(), steps: 0, terminal: false };
    this.spawn();
    this.spawn();
  }

  /** Deep copy for baseline lookahead. */
  clone(): Game2048 {
    const copy = new Game2048({ id: this.id, size: this.size, seed: 1, target: this.target });
    copy.state_ = { board: this.state_.board.map((row) => [...row]), steps: this.state_.steps, terminal: this.state_.terminal };
    copy.rng.setState(this.rng.getState());
    return copy;
  }

  state(): Game2048State {
    return this.state_;
  }

  private spawn(): void {
    const free: Array<[number, number]> = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (this.state_.board[r]![c] === 0) free.push([r, c]);
    if (free.length === 0) return;
    const [r, c] = free[this.rng.nextInt(free.length)]!;
    this.state_.board[r]![c] = this.rng.next() < 0.9 ? 2 : 4;
  }

  private slide(row: number[]): { row: number[]; gained: number } {
    const tiles = row.filter((v) => v !== 0);
    const out: number[] = [];
    let gained = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
        const merged = tiles[i]! * 2;
        out.push(merged);
        gained += merged;
        i++;
      } else out.push(tiles[i]!);
    }
    while (out.length < this.size) out.push(0);
    return { row: out, gained };
  }

  private moved(board: number[][], next: number[][]): boolean {
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (board[r]![c] !== next[r]![c]) return true;
    return false;
  }

  private apply(board: number[][], action: Move2048): { board: number[][]; gained: number } {
    const next = board.map((row) => [...row]);
    let gained = 0;
    const rot = (b: number[][]): number[][] =>
      b[0]!.map((_, i) => b.map((row) => row[i]!).reverse());

    let work = next;
    const turns = action; // rotate so the move is always a left-slide
    for (let t = 0; t < turns; t++) work = rot(work);
    for (let i = 0; i < work.length; i++) {
      const { row, gained: g } = this.slide(work[i]!);
      work[i] = row;
      gained += g;
    }
    for (let t = 0; t < (4 - turns) % 4; t++) work = rot(work);
    return { board: work, gained };
  }

  legalActions(state: Game2048State): Move2048[] {
    if (state.terminal) return [];
    const legal: Move2048[] = [];
    for (const action of [0, 1, 2, 3] as Move2048[]) {
      const { board: next } = this.apply(state.board, action);
      if (this.moved(state.board, next)) legal.push(action);
    }
    return legal;
  }

  step(action: Move2048): GameOutcome {
    const state = this.state_;
    if (state.terminal) return { reward: 0, terminal: true };
    const { board: next, gained } = this.apply(state.board, action);
    if (!this.moved(state.board, next)) return { reward: -1, terminal: true, info: { reason: 'illegal' } };

    state.board = next;
    state.steps++;
    this.spawn();

    let terminal = this.legalActions(state).length === 0;
    if (state.board.some((row) => row.some((v) => v >= this.target))) terminal = true;
    state.terminal = terminal;
    return { reward: Math.min(1, gained / 64), terminal, info: { gained } };
  }

  observe(): Perception {
    return {
      stateId: this.stateKey(),
      features: { emptyCells: this.state_.board.flat().filter((v) => v === 0).length, steps: this.state_.steps, maxTile: Math.max(...this.state_.board.flat()) },
      confidence: 1,
      terminal: this.state_.terminal,
    };
  }

  stateKey(): string {
    return this.state_.board.map((row) => row.join(',')).join('|');
  }

  render(): string {
    return this.state_.board.map((row) => row.map((v) => String(v || '.').padStart(4)).join(' ')).join('\n');
  }
}

export function createGame2048(config: Game2048Config = {}): Game2048 {
  return new Game2048(config);
}
