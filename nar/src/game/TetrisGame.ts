import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

/** Placement action: 'place:r<rotation>:c<column>' (hard drop). */
export type TetrisPlacement = string;

export interface TetrisPiece {
  type: number;
  rot: number;
  col: number;
  row: number;
}

export interface TetrisState {
  grid: number[][];
  piece: TetrisPiece | null;
  piecesPlaced: number;
  linesCleared: number;
  terminal: boolean;
}

export interface TetrisGameConfig {
  id?: string;
  width?: number;
  height?: number;
  seed?: number;
  /** Enumeration cap for legalPlacements; truncation is deterministic (row-major). */
  placementCap?: number;
  pieceCap?: number;
}

/** 7 tetrominoes as base matrices; rotations generated deterministically (CW). */
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [0, 1, 0],
    [1, 1, 1],
  ], // T
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // S
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // Z
  [
    [1, 0, 0],
    [1, 1, 1],
  ], // J
  [
    [0, 0, 1],
    [1, 1, 1],
  ], // L
];

const rotateCW = (m: number[][]): number[][] => m[0]!.map((_, i) => m.map((row) => row[i]!).reverse());

const cellsOf = (type: number, rot: number): Array<[number, number]> => {
  let m = SHAPES[type]!;
  for (let i = 0; i < rot % 4; i++) m = rotateCW(m);
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < m.length; r++)
    for (let c = 0; c < m[r]!.length; c++) if (m[r]![c]) cells.push([r, c]);
  return cells;
};

const rotationCount = (type: number): number => (type === 1 ? 1 : type === 0 ? 2 : 4);

export class TetrisGame implements Game<TetrisState, TetrisPlacement> {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly placementCap: number;
  private readonly pieceCap: number;
  private readonly rng: SeededRNG;
  private readonly bag: number[] = [];
  private state_: TetrisState;

  constructor(config: TetrisGameConfig = {}) {
    this.id = config.id ?? 'tetris';
    this.width = config.width ?? 10;
    this.height = config.height ?? 10;
    this.placementCap = config.placementCap ?? 64;
    this.pieceCap = config.pieceCap ?? 100;
    this.rng = new SeededRNG(config.seed ?? 1);
    this.state_ = { grid: this.emptyGrid(), piece: null, piecesPlaced: 0, linesCleared: 0, terminal: false };
    this.spawn();
  }

  private emptyGrid(): number[][] {
    return Array.from({ length: this.height }, () => Array(this.width).fill(0));
  }

  reset(): void {
    this.bag.length = 0;
    this.state_ = { grid: this.emptyGrid(), piece: null, piecesPlaced: 0, linesCleared: 0, terminal: false };
    this.spawn();
  }

  /** Deep copy for baseline lookahead. */
  clone(): TetrisGame {
    const copy = new TetrisGame({
      id: this.id,
      width: this.width,
      height: this.height,
      seed: 1,
      placementCap: this.placementCap,
      pieceCap: this.pieceCap,
    });
    copy.state_ = {
      grid: this.state_.grid.map((row) => [...row]),
      piece: this.state_.piece ? { ...this.state_.piece } : null,
      piecesPlaced: this.state_.piecesPlaced,
      linesCleared: this.state_.linesCleared,
      terminal: this.state_.terminal,
    };
    copy.bag.push(...this.bag);
    copy.rng.setState(this.rng.getState());
    return copy;
  }

  state(): TetrisState {
    return this.state_;
  }

  /** Bag-7 piece generator. */
  private nextType(): number {
    if (this.bag.length === 0) {
      const bag = [0, 1, 2, 3, 4, 5, 6];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = this.rng.nextInt(i + 1);
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      this.bag.push(...bag);
    }
    return this.bag.shift()!;
  }

  private collides(cells: Array<[number, number]>, row: number, col: number, grid: number[][]): boolean {
    for (const [dr, dc] of cells) {
      const r = row + dr;
      const c = col + dc;
      if (c < 0 || c >= this.width || r >= this.height) return true;
      if (r >= 0 && grid[r]![c]) return true;
    }
    return false;
  }

  private landingRow(cells: Array<[number, number]>, col: number, grid: number[][]): number {
    let row = -this.height;
    while (!this.collides(cells, row + 1, col, grid)) row++;
    return row;
  }

  private spawn(): void {
    const type = this.nextType();
    const col = Math.floor((this.width - 1) / 2) - 1;
    const piece: TetrisPiece = { type, rot: 0, col, row: 0 };
    if (this.collides(cellsOf(type, 0), 0, col, this.state_.grid)) {
      this.state_.terminal = true;
      this.state_.piece = null;
      return;
    }
    this.state_.piece = piece;
  }

  /**
   * Deterministic placement enumeration (hard drop from every rotation × entry
   * column). Truncated at `placementCap` in enumeration order — documented
   * truncation (tuck/soft-drop placements under overhangs beyond one-step
   * lateral slides are not enumerated).
   */
  legalPlacements(state: TetrisState = this.state_): TetrisPlacement[] {
    if (state.terminal || !state.piece) return [];
    const { type } = state.piece;
    const placements: TetrisPlacement[] = [];
    for (let rot = 0; rot < rotationCount(type); rot++) {
      const cells = cellsOf(type, rot);
      const maxCol = Math.max(...cells.map(([, c]) => c));
      const minCol = Math.min(...cells.map(([, c]) => c));
      for (let col = -minCol; col < this.width - maxCol; col++) {
        const row = this.landingRow(cells, col, state.grid);
        if (this.collides(cells, row, col, state.grid)) continue;
        placements.push(`place:r${rot}:c${col}`);
        if (placements.length >= this.placementCap) return placements;
      }
    }
    return placements;
  }

  legalActions(state: TetrisState): TetrisPlacement[] {
    return this.legalPlacements(state);
  }

  step(action: TetrisPlacement): GameOutcome {
    const state = this.state_;
    const match = /^place:r(\d+):c(-?\d+)$/.exec(action);
    if (state.terminal || !state.piece || !match)
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };
    const rot = Number(match[1]);
    const col = Number(match[2]);
    const cells = cellsOf(state.piece.type, rot);
    if (this.collides(cells, this.landingRow(cells, col, state.grid), col, state.grid))
      return { reward: -1, terminal: true, info: { reason: 'illegal' } };

    const row = this.landingRow(cells, col, state.grid);
    for (const [dr, dc] of cells) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0) state.grid[r]![c] = 1;
    }

    let cleared = 0;
    for (let r = this.height - 1; r >= 0; r--) {
      if (state.grid[r]!.every((v) => v === 1)) {
        state.grid.splice(r, 1);
        state.grid.unshift(Array(this.width).fill(0));
        cleared++;
        r++;
      }
    }
    state.linesCleared += cleared;
    state.piecesPlaced++;

    const lineReward = [0, 1, 3, 5, 8][cleared] ?? 8;
    const reward = Math.min(1, lineReward / 8);
    if (state.piecesPlaced >= this.pieceCap) {
      state.terminal = true;
      state.piece = null;
      return { reward, terminal: true, info: { pieceCap: true } };
    }
    this.spawn();
    return { reward, terminal: state.terminal, info: { cleared } };
  }

  observe(): Perception {
    const s = this.state_;
    return {
      stateId: this.stateKey(),
      features: {
        stackHeight: this.stackHeight(),
        holes: this.holes(),
        linesCleared: s.linesCleared,
        piecesPlaced: s.piecesPlaced,
      },
      confidence: 1,
      terminal: s.terminal,
    };
  }

  private stackHeight(): number {
    for (let r = 0; r < this.height; r++)
      if (this.state_.grid[r]!.some((v) => v === 1)) return this.height - r;
    return 0;
  }

  private holes(): number {
    let holes = 0;
    for (let c = 0; c < this.width; c++) {
      let seen = false;
      for (let r = 0; r < this.height; r++) {
        if (this.state_.grid[r]![c]) seen = true;
        else if (seen) holes++;
      }
    }
    return holes;
  }

  stateKey(): string {
    const s = this.state_;
    return s.grid.map((row) => row.join('')).join('|') + `#${s.piece?.type ?? 'x'}`;
  }

  render(): string {
    const grid = this.state_.grid.map((row) => [...row]);
    const piece = this.state_.piece;
    if (piece) {
      const cells = cellsOf(piece.type, piece.rot);
      let row = piece.row;
      while (!this.collides(cells, row + 1, piece.col, this.state_.grid)) row++;
      for (const [dr, dc] of cells) {
        const r = row + dr;
        const c = piece.col + dc;
        if (r >= 0 && r < this.height && !grid[r]![c]) grid[r]![c] = 2;
      }
    }
    return grid.map((row) => row.map((v) => (v === 1 ? '#' : v === 2 ? '>' : '.')).join(' ')).join('\n');
  }
}

export function createTetrisGame(config: TetrisGameConfig = {}): TetrisGame {
  return new TetrisGame(config);
}
