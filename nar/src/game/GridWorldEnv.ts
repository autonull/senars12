import { SeededRNG } from './SeededRNG.js';

export interface GridWorldConfig {
  grid: string[];
  seed: number;
  maxSteps?: number;
  /** Probability of executing a random action instead of the requested one. */
  slipProbability?: number;
}

export type GridAction = 0 | 1 | 2 | 3;

export interface GridWorldState {
  row: number;
  col: number;
  /** Goal position (part of the state so embeddings digest the full state). */
  goalRow: number;
  goalCol: number;
  /** True when the agent stands on the goal (or the step cap was hit). */
  terminal?: boolean;
}

export class GridWorldEnv {
  private rng: SeededRNG;
  private readonly grid: string[][];
  readonly rows: number;
  readonly cols: number;
  readonly startPos!: Omit<GridWorldState, 'terminal'>;
  readonly goalPos!: Omit<GridWorldState, 'goalRow' | 'goalCol' | 'terminal'> & { goalRow: number; goalCol: number };
  currentPos: GridWorldState;
  private stepCount = 0;
  readonly maxSteps: number;
  readonly slipProbability: number;
  readonly walls: Set<string>;

  constructor(config: GridWorldConfig) {
    this.rng = new SeededRNG(config.seed);
    this.slipProbability = config.slipProbability ?? 0;
    this.grid = config.grid.map((row) => row.split(''));
    this.rows = this.grid.length;
    this.cols = this.grid[0]!.length;
    this.maxSteps = config.maxSteps ?? 100;

    this.walls = new Set();
    let startFound = false;
    let goalFound = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r]?.[c] ?? ' ';
        if (cell === '#') this.walls.add(`${r},${c}`);
        else if (cell === 'S') {
          this.startPos = { row: r, col: c, goalRow: 0, goalCol: 0 };
          startFound = true;
        } else if (cell === 'G') {
          this.goalPos = { row: r, col: c, goalRow: r, goalCol: c };
          goalFound = true;
        }
      }
    }
    if (!startFound || !goalFound) throw new Error('Grid must have S and G');
    this.currentPos = { ...this.startPos, goalRow: this.goalPos.row, goalCol: this.goalPos.col };
  }

  reset(): GridWorldState {
    this.currentPos = { ...this.startPos, goalRow: this.goalPos.row, goalCol: this.goalPos.col };
    this.stepCount = 0;
    return this.getState();
  }

  step(action: GridAction): { state: GridWorldState; reward: number; done: boolean } {
    this.stepCount++;
    // Guard the RNG stream when slipProbability is 0 so determinism is preserved
    let effectiveAction = action;
    if (this.slipProbability > 0 && this.rng.next() < this.slipProbability) {
      effectiveAction = this.rng.nextInt(4) as GridAction;
    }
    const { row, col } = this.currentPos;
    let newRow = row;
    let newCol = col;

    switch (effectiveAction) {
      case 0:
        newRow = Math.max(0, row - 1);
        break;
      case 1:
        newCol = Math.min(this.cols - 1, col + 1);
        break;
      case 2:
        newRow = Math.min(this.rows - 1, row + 1);
        break;
      case 3:
        newCol = Math.max(0, col - 1);
        break;
    }

    if (!this.walls.has(`${newRow},${newCol}`)) {
      this.currentPos = { row: newRow, col: newCol, goalRow: this.goalPos.row, goalCol: this.goalPos.col };
    }

    const done =
      this.currentPos.row === this.goalPos.row && this.currentPos.col === this.goalPos.col;
    const reward = done ? 1 : -0.01;

    return { state: this.getState(), reward, done: done || this.stepCount >= this.maxSteps };
  }

  getState(): GridWorldState {
    return {
      ...this.currentPos,
      goalRow: this.goalPos.row,
      goalCol: this.goalPos.col,
    };
  }

  getSlipProbability(): number {
    return this.slipProbability;
  }

  getNumActions(): number {
    return 4;
  }

  getStateKey(): string {
    return `${this.currentPos.row},${this.currentPos.col}`;
  }
}
