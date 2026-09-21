import type { Game, GameOutcome, Perception } from './Game.js';
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

/** Actions: 0=up, 1=right, 2=down, 3=left (clamped at edges; walls block). */
const DELTAS: ReadonlyArray<{ dr: number; dc: number }> = [
  { dr: -1, dc: 0 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
];

/** Gridworld as a plain `Game` — ASCII `grid` with `S` start, `G` goal, `#` walls. */
export class GridWorldGame implements Game<GridWorldState, GridAction> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private readonly rows: number;
  private readonly cols: number;
  private readonly walls: Set<string>;
  private readonly startPos: { row: number; col: number };
  private readonly goalPos: { row: number; col: number };
  private readonly maxSteps: number;
  private readonly slipProbability: number;
  private currentPos: { row: number; col: number };
  private stepCount = 0;
  private terminal_ = false;

  constructor(config: GridWorldConfig & { id?: string }) {
    this.id = config.id ?? 'gridworld';
    this.rng = new SeededRNG(config.seed);
    this.slipProbability = config.slipProbability ?? 0;
    this.maxSteps = config.maxSteps ?? 100;
    this.walls = new Set();
    let start: { row: number; col: number } | undefined;
    let goal: { row: number; col: number } | undefined;
    this.rows = config.grid.length;
    this.cols = config.grid[0]?.length ?? 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = config.grid[r]?.[c] ?? ' ';
        if (cell === '#') this.walls.add(`${r},${c}`);
        else if (cell === 'S') start = { row: r, col: c };
        else if (cell === 'G') goal = { row: r, col: c };
      }
    }
    if (!start || !goal) throw new Error('Grid must have S and G');
    this.startPos = start;
    this.goalPos = goal;
    this.currentPos = start;
  }

  observe(): Perception {
    return {
      stateId: this.getStateKey(),
      features: {
        row: this.currentPos.row,
        col: this.currentPos.col,
        goalRow: this.goalPos.row,
        goalCol: this.goalPos.col,
        distanceToGoal: this.distanceToGoal(),
      },
      confidence: 1.0,
      terminal: this.terminal_,
    };
  }

  state(): GridWorldState {
    return {
      ...this.currentPos,
      goalRow: this.goalPos.row,
      goalCol: this.goalPos.col,
      terminal: this.terminal_,
    };
  }

  legalActions(state: GridWorldState): GridAction[] {
    const moves = ([0, 1, 2, 3] as GridAction[]).filter((action) => {
      const { dr, dc } = DELTAS[action]!;
      return !this.walls.has(`${state.row + dr},${state.col + dc}`);
    });
    return moves.length > 0 ? moves : [0, 1, 2, 3];
  }

  step(action: GridAction): GameOutcome {
    this.stepCount++;
    // Guard the RNG stream when slipProbability is 0 so determinism is preserved
    let effectiveAction = action;
    if (this.slipProbability > 0 && this.rng.next() < this.slipProbability)
      effectiveAction = this.rng.nextInt(4) as GridAction;
    const { dr, dc } = DELTAS[effectiveAction]!;
    const next = {
      row: this.currentPos.row + dr,
      col: this.currentPos.col + dc,
    };
    // Edge clamping: out-of-bounds targets never move (same as a wall).
    const inBounds = next.row >= 0 && next.row < this.rows && next.col >= 0 && next.col < this.cols;
    if (inBounds && !this.walls.has(`${next.row},${next.col}`)) this.currentPos = next;
    this.terminal_ = this.isTerminal() || this.stepCount >= this.maxSteps;
    return { reward: this.isTerminal() ? 1 : -0.01, terminal: this.terminal_, info: { stepCount: this.stepCount } };
  }

  reset(): void {
    this.currentPos = this.startPos;
    this.stepCount = 0;
    this.terminal_ = false;
  }

  getSlipProbability(): number {
    return this.slipProbability;
  }

  render(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        if (r === this.currentPos.row && c === this.currentPos.col) line += 'S';
        else if (r === this.goalPos.row && c === this.goalPos.col) line += 'G';
        else if (this.walls.has(`${r},${c}`)) line += '#';
        else line += '.';
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  private isTerminal(): boolean {
    return this.currentPos.row === this.goalPos.row && this.currentPos.col === this.goalPos.col;
  }

  private distanceToGoal(): number {
    return Math.abs(this.currentPos.row - this.goalPos.row) + Math.abs(this.currentPos.col - this.goalPos.col);
  }

  private getStateKey(): string {
    return `${this.currentPos.row},${this.currentPos.col}`;
  }
}

export function createGridWorldGame(config: GridWorldConfig & { id?: string }): GridWorldGame {
  return new GridWorldGame(config);
}
