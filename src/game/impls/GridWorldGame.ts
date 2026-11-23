import type { GameOutcome, Perception } from '../Game';
import { renderGrid } from '../render';
import { SeededRNG } from '@senars/util/random';
import { GameBase, type GameConfig } from '../GameBase';
import { SenarsError } from '../../errors/senars-error';

export interface GridWorldConfig {
  grid: string[];
  seed: number;
  maxSteps?: number;
  /** Probability of executing a random action instead of the requested one. */
  slipProbability?: number;
  [key: string]: unknown;
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
export class GridWorldGame extends GameBase<GridWorldState, GridAction> {
  private readonly rows: number;
  private readonly cols: number;
  private readonly walls: Set<string>;
  private readonly startPos: { row: number; col: number };
  private readonly goalPos: { row: number; col: number };
  private readonly slipProbability: number;
  private currentPos: { row: number; col: number };
  private terminal_ = false;

  constructor(config: GridWorldConfig & { id?: string }) {
    super(config.id ?? 'gridworld', config);
    this.slipProbability = config.slipProbability ?? 0;
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
    if (!start || !goal) throw new SenarsError('Grid must have S and G', 'CONFIGURATION_ERROR');
    this.startPos = start;
    this.goalPos = goal;
    this.currentPos = start;
  }

  protected getInitialState(): GridWorldState {
    return {
      ...this.startPos,
      goalRow: this.goalPos.row,
      goalCol: this.goalPos.col,
      terminal: false,
    };
  }

  protected getStateId(state: GridWorldState): string {
    return `${state.row},${state.col}`;
  }

  override step(action: GridAction): GameOutcome {
    this.incrementStep();
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
    this.terminal_ = this.isAtGoal() || this.stepCount >= this.maxSteps;
    return {
      reward: this.isAtGoal() ? 1 : -0.01,
      terminal: this.terminal_,
      info: { stepCount: this.stepCount },
    };
  }

  override isTerminal(state: GridWorldState): boolean {
    return state.terminal ?? false;
  }

  private isAtGoal(): boolean {
    return this.currentPos.row === this.goalPos.row && this.currentPos.col === this.goalPos.col;
  }

  override legalActions(state: GridWorldState): GridAction[] {
    const moves = ([0, 1, 2, 3] as GridAction[]).filter((action) => {
      const { dr, dc } = DELTAS[action]!;
      return !this.walls.has(`${state.row + dr},${state.col + dc}`);
    });
    return moves.length > 0 ? moves : [0, 1, 2, 3];
  }

  override state(): GridWorldState {
    return {
      ...this.currentPos,
      goalRow: this.goalPos.row,
      goalCol: this.goalPos.col,
      terminal: this.terminal_,
    };
  }

  override observe(): Perception {
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

  override reset(): GridWorldState {
    this.currentPos = this.startPos;
    this.stepCount = 0;
    this.terminal_ = false;
    return this.getInitialState();
  }

  getSlipProbability(): number {
    return this.slipProbability;
  }

  render(): string {
    return renderGrid(this.rows, this.cols, (r, c) =>
      r === this.currentPos.row && c === this.currentPos.col
        ? 'S'
        : r === this.goalPos.row && c === this.currentPos.col
          ? 'G'
          : this.walls.has(`${r},${c}`)
            ? '#'
            : '.'
    );
  }

  private distanceToGoal(): number {
    return (
      Math.abs(this.currentPos.row - this.goalPos.row) +
      Math.abs(this.currentPos.col - this.goalPos.col)
    );
  }

  private getStateKey(): string {
    return `${this.currentPos.row},${this.currentPos.col}`;
  }
}

export function createGridWorldGame(config: GridWorldConfig & { id?: string }): GridWorldGame {
  return new GridWorldGame(config);
}