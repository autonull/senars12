import { clamp01 } from '@senars/util/numeric';
import { maxScore } from '@senars/util/collections';
import { SeededRNG } from '@senars/util/random';
import type { Game, GameOutcome, Perception } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';

export type Move2048 = 0 | 1 | 2 | 3; // left, up, right, down

export interface Game2048State {
  board: number[][];
  steps: number;
  terminal: boolean;
}

export interface Game2048Config extends GameConfig {
  size?: number;
  target?: number;
}

export class Game2048 extends GameBase<Game2048State, Move2048> {
  private readonly size: number;
  private readonly target: number;
  private board: number[][];
  private steps = 0;
  private terminal_ = false;

  constructor(config: Game2048Config = {}) {
    super(config.id ?? '2048', config);
    this.size = config.size ?? 4;
    this.target = config.target ?? 2048;
    this.board = this.emptyBoard();
    this.spawn();
    this.spawn();
  }

  private emptyBoard(): number[][] {
    return Array.from({ length: this.size }, () => Array(this.size).fill(0));
  }

  protected override getInitialState(): Game2048State {
    const board = this.emptyBoard();
    // Spawn two initial tiles
    const free: Array<[number, number]> = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (board[r]![c] === 0) free.push([r, c]);
    if (free.length > 0) {
      const [r, c] = free[this.rng.nextInt(free.length)]!;
      board[r]![c] = this.rng.next() < 0.9 ? 2 : 4;
    }
    if (free.length > 1) {
      const [r, c] = free[this.rng.nextInt(free.length - 1)]!;
      board[r]![c] = this.rng.next() < 0.9 ? 2 : 4;
    }
    return { board, steps: 0, terminal: false };
  }

  protected override getStateId(state: Game2048State): string {
    return state.board.map((row) => row.join(',')).join('|');
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

  private spawn(): void {
    const free: Array<[number, number]> = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++) if (this.board[r]![c] === 0) free.push([r, c]);
    if (free.length === 0) return;
    const [r, c] = free[this.rng.nextInt(free.length)]!;
    this.board[r]![c] = this.rng.next() < 0.9 ? 2 : 4;
  }

  override step(action: Move2048): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true };
    const { board: next, gained } = this.apply(this.board, action);
    if (!this.moved(this.board, next))
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };

    this.board = next;
    this.steps++;
    this.incrementStep();
    this.spawn();

    let terminal = this.legalActions(this.state()).length === 0;
    if (this.board.some((row) => row.some((v) => v >= this.target))) terminal = true;
    this.terminal_ = terminal;
    return { reward: clamp01(gained / 64), terminal, info: { gained } };
  }

  override isTerminal(state: Game2048State): boolean {
    return state.terminal;
  }

  override legalActions(state: Game2048State): Move2048[] {
    if (state.terminal) return [];
    const legal: Move2048[] = [];
    for (const action of [0, 1, 2, 3] as Move2048[]) {
      const { board: next } = this.apply(state.board, action);
      if (this.moved(state.board, next)) legal.push(action);
    }
    return legal;
  }

  override state(): Game2048State {
    return {
      board: this.board.map((row) => [...row]),
      steps: this.steps,
      terminal: this.terminal_,
    };
  }

  override observe(): Perception {
    const cells = this.board.flat();
    return {
      stateId: this.getStateId(this.state()),
      features: {
        emptyCells: cells.filter((v) => v === 0).length,
        steps: this.steps,
        maxTile: maxScore(cells, (v) => v),
      },
      confidence: 1,
      terminal: this.terminal_,
    };
  }

  override reset(): Game2048State {
    this.board = this.emptyBoard();
    this.steps = 0;
    this.terminal_ = false;
    this.stepCount = 0;
    this.spawn();
    this.spawn();
    return this.getInitialState();
  }

  stateKey(): string {
    return this.board.map((row) => row.join(',')).join('|');
  }

  render(): string {
    return this.board
      .map((row) => row.map((v) => String(v || '.').padStart(4)).join(' '))
      .join('\n');
  }

  /** Deep copy for baseline lookahead. */
  clone(): Game2048 {
    const copy = new Game2048({ id: this.id, size: this.size, seed: 1, target: this.target });
    copy.board = this.board.map((row) => [...row]);
    copy.steps = this.steps;
    copy.terminal_ = this.terminal_;
    copy.stepCount = this.stepCount;
    copy.rng = new SeededRNG(this.seed);
    for (let i = 0; i < this.stepCount; i++) copy.rng.next();
    return copy;
  }
}

export function createGame2048(config: Game2048Config = {}): Game2048 {
  return new Game2048(config);
}